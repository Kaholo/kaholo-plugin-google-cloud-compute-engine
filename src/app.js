const Compute = require('@google-cloud/compute');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const { _stringArrayParamHandler } = require('./helper')

function _getCredentials(action, settings) {
    const keysParam = action.params.CREDENTIALS || settings.CREDENTIALS;
    if (typeof keysParam != 'string') {
        return keysParam;
    } 
    else {
        try {
            return JSON.parse(keysParam);
        } 
        catch (err) {
            throw new Error("Invalid credentials JSON");
        }
    }
}

async function _handleOperation(operation){
    return new Promise((resolve,reject)=>{
        try {
            operation
                .on('error', function (err) {
                    reject(err);
                })
                .on('running', function (metadata) {
                    console.log(JSON.stringify(metadata));
                })
                .on('complete', function (metadata) {
                    resolve(metadata);
                });
        } catch (e) {
            reject(e);
        }    
    })
}

function _gcpCallback(action, resolve, reject){
    return (err, entity, operation, apiResponse) => {
        if (err)
            return reject(err);
        
        if(!action.params.waitForOperation)
            return resolve(apiResponse);

        _handleOperation(operation).then(resolve).catch(reject);
    }
}

async function _autoCreateExtIP(compute, zone, instanceName, config){
    const regionStr = zone.substr(0, zone.lastIndexOf('-')); // get region from zone
    const region = compute.region(regionStr);
    const addrName = `${instanceName}-ext-addr`;
    try {
        const [address, operation] = (await region.createAddress(addrName, {addressType: "EXTERNAL"}));
        await _handleOperation(operation);
        const extIpAddr = (await address.getMetadata())[0].address;
        return extIpAddr;
    }
    catch (err){
        throw `Couldn't create external address with the name: ${addrName}\n${err}`;
    }
}

function authenticate(action, settings, withoutProject) {
    const credentials = _getCredentials(action, settings);

    let computeOptions = { credentials }
    if (!withoutProject) {
        computeOptions.projectId = action.params.PROJECT
    }

    return new Compute(computeOptions);
}

async function launchInstance(action, settings) {
    if (!action.params.ZONE || !action.params.NAME || !action.params.PROJECT){
        throw new Error("One of the following required parameters is missing: Name, Zone, Project Id");
    }
    let config = {
        os: action.params.OS,
        disks: [],
        canIpForward : action.params.canIpForward
    };
    const zoneString = action.params.ZONE.replace(/–/g,'-');
    const name = action.params.NAME;
    const compute = authenticate(action, settings);
    const zone = compute.zone(zoneString);

    if (action.params.IMAGE) {
        let initializeParams = {
            sourceImage: action.params.IMAGE
        };

        if(action.params.diskType){
            initializeParams.diskType = `zones/${zoneString}/diskTypes/${action.params.diskType}`;
        }

        config.disks.push({
            boot: true,
            initializeParams: initializeParams,
            autoDelete : action.params.diskAutoDelete || false
        });
    }

    if (action.params.preemptible){
        config.scheduling = {
            preemptible: true
        };
    }

    if (action.params.networkInterfaces){
        if (!Array.isArray(action.params.networkInterfaces))
            throw new Error("Network interfaces must be an array.");
        config.networkInterfaces = action.params.networkInterfaces;
    } 
    else if (action.params.NETWORK) {
        if (!action.params.SUBNET || !action.params.NETIP){
            throw new Error("You must specify subnet and ip to use specific VPC");
        }
        config.networkInterfaces = [
            {
                network: `projects/${action.params.PROJECT}/global/networks/${action.params.NETWORK}`,
                subnetwork: action.params.SUBNET,
                networkIP: action.params.NETIP
            }
        ]
    }

    if (action.params.TAGS) {
        config.tags = {
            items : _stringArrayParamHandler(action.params.TAGS, 'Tags')
        };
    }

    if (action.params.LABELS) {
        if (typeof action.params.LABELS != 'object' || Array.isArray(action.params.LABELS))
            throw new Error("Labels object must be an object");
        config.labels = action.params.LABELS;
    }

    if (action.params.MACHINE_TYPE) {
        config.machineType = action.params.MACHINE_TYPE;
    }

    if (action.params.autoCreateStaticIP) {
        const extIpAddr = await _autoCreateExtIP(compute, zoneString, name, config);
        if (!config.networkInterfaces || config.networkInterfaces.length == 0){
            config.networkInterfaces = [{ accessConfigs: [{ natIP: extIpAddr }]}];
        }
        else {
            const netInterface = config.networkInterfaces[0];
            if (!netInterface.accessConfigs || netInterface.accessConfigs.length == 0){
                netInterface.accessConfigs = [{natIP: extIpAddr}];
            }
            else {
                netInterface.accessConfigs[0].natIP = extIpAddr;
            }
        }
    }
    return new Promise((resolve, reject) => {
        zone.createVM(name, config, _gcpCallback(action,resolve,reject));
    });
}

async function deleteUpdateRestartInstance(action, settings) {
    const compute = authenticate(action, settings);
    const zone = compute.zone(action.params.ZONE);
    const vm = zone.vm(action.params.NAME);
    let res = {};
    switch (action.method.name) {
        case 'STOP_INSTANCE':
            res = await vm.stop();
            break;
        case 'DELETE_INSTANCE':
            res = await vm.delete();
            break;
        case 'RESET_INSTANCE':
            res = await vm.reset();
            break;
        default:
            throw new Error("Unknown method");
    }
    return res[1];
}

async function getExternalIP(action, settings) {
    const compute = authenticate(action, settings);
    const zone = compute.zone(action.params.ZONE);
    const vm = zone.vm(action.params.NAME);
    return new Promise((resolve, reject) => {
        vm.getMetadata().then((data) => {
            if ((((((data[0] || {}).networkInterfaces || [])[0] || {}).accessConfigs || [])[0] || {}).natIP) {
                resolve(data[0].networkInterfaces[0].accessConfigs[0].natIP);
            } else {
                reject('No external IP');
            }
        });
    });
}

async function createVpc(action, settings) {
    const compute = authenticate(action, settings);

    const network = compute.network(action.params.NAME);
    const config = { autoCreateSubnetworks: false };
    return new Promise((resolve, reject) => {
        network.create(config, _gcpCallback(action, resolve, reject));
    })
}

async function createSubnet(action, settings) {
    const compute = authenticate(action, settings);
    const network = compute.network(action.params.NETID);
    const config = {
        region: action.params.REGION,
        range: action.params.IPRANGE
    };
    return new Promise((resolve, reject) => {
        network.createSubnetwork(action.params.SUBNAME, config, _gcpCallback(action, resolve, reject));
    })
}

async function reserveIp(action, settings) {
    const compute = authenticate(action, settings);
    const resName = action.params.RESNAME;
    const region = compute.region(action.params.REGION);
    const config = {
        subnetwork: 'regions/' + action.params.REGION + '/subnetworks/' + action.params.SUBNAME,
        addressType: 'INTERNAL',
        address: action.params.RESIP
    };
    return new Promise((resolve, reject) => {
        region.createAddress(resName, config, (err, t, t2, apiResponse) => {
            if (err)
                return reject(err);
            resolve(apiResponse);
        });
    })
}

async function createFW(action, settings) {
    const compute = authenticate(action, settings);
    const firewall = compute.firewall(action.params.FWNAME);
    const fwAction = action.params.action || 'allow';
    let priority = action.params.PRIORITY ? parseInt(action.params.PRIORITY) : 1000;
    if (isNaN(priority)) priority = 1000;
    const netName = action.params.NETNAME || `default`
    let config = {
        network: `projects/${action.params.PROJECT}/global/networks/${netName}`,
        destinationRanges: [],
        sourceRanges: [],
        priority : priority,
        direction : action.params.direction || 'INGRESS'
    };
    let ports = [];
    if (action.params.PORTS){
        if (action.params.PORTS instanceof Array){
            ports = action.params.PORTS.map(port=>`${port}`);
        } else {    
            ports = [`${action.params.PORTS}`];
        }
    }
    const fwRule = {
        IPProtocol: action.params.PROTOCOL || 'all',
        ports: ports
    }
    if(fwAction=='allow'){
        config.allowed = [fwRule]
    } else if (fwAction=='deny'){
        config.denied = [fwRule]
    }
    if (action.params.SOURCERANGE) {
        config.sourceRanges = _stringArrayParamHandler(action.params.SOURCERANGE, 'Source Ranges');
    }
    if (action.params.DESTRANGE) {
        config.destinationRanges = _stringArrayParamHandler(action.params.DESTRANGE, 'Destination Ranges');
    }
    return new Promise((resolve, reject) => {
        firewall.create(config, (err, t, t2, apiResponse) => {
            if (err)
                return reject(err);
            resolve(apiResponse);
        });
    })
}

async function createRoute(action, settings) {
    const keys = _getCredentials(action, settings);
    
    const client = new JWT(
        keys.client_email, null,
        keys.private_key,
        ['https://www.googleapis.com/auth/cloud-platform'],
    );
    const request = {
        project: action.params.PROJECT,
        resource:
        {
            name: action.params.NAME,
            network: `projects/${action.params.PROJECT}/global/networks/${action.params.NETWORK}`,
            nextHopIp: action.params.NEXTHOPIP,
            destRange: action.params.DESTRANGE,
            priority: action.params.PRIORITY || '0',
            tags : action.params.TAGS ? _stringArrayParamHandler(action.params.TAGS) : []
        },
        auth: client
    };
    const compute = google.compute('v1');
    return new Promise((resolve, reject) => {
        compute.routes.insert(request, function (err, res) {
            if (err)
                return reject(err);
            resolve(res)
        });
    });
}

module.exports = {
    LAUNCH_INSTANCE: launchInstance,
    STOP_INSTANCE: deleteUpdateRestartInstance,
    DELETE_INSTANCE: deleteUpdateRestartInstance,
    RESET_INSTANCE: deleteUpdateRestartInstance,
    GET_INSTANCE_EXTERNAL_IP: getExternalIP,
    createVpc: createVpc,
    createSubnet: createSubnet,
    reserveIp: reserveIp,
    createFW: createFW,
    createRoute: createRoute
};

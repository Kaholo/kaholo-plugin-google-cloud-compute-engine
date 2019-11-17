const Compute = require('@google-cloud/compute');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const { _handleParam, _stringArrayParamHandler } = require('./helper')

function _getCredentials(action, settings) {
    let keysParam = action.params.CREDENTIALS || settings.CREDENTIALS;
    if (typeof keysParam != 'string') {
        return keysParam;
    } else {
        try {
            return JSON.parse(keysParam)
        } catch (err) {
            throw new Error("Invalid credentials JSON");
        }
    }
}

function _handleOPeration(operation){
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

        _handleOPeration(operation).then(resolve).catch(reject);
    }
}

function authenticate(action, settings, withoutProject) {
    let credentials = _getCredentials(action, settings);

    let computeOptions = {
        credentials
    }

    if (!withoutProject) {
        computeOptions.projectId = action.params.PROJECT
    }

    return new Compute(computeOptions);
}

function launchInstance(action, settings) {
    return new Promise((resolve, reject) => {
        if (!action.params.ZONE || !action.params.NAME || !action.params.PROJECT){
            return reject(new Error("One of the following required parameters is missing: Name, Zone, Project Id"));
        }

        const zoneString = action.params.ZONE.replace(/–/g,'-');

        const compute = authenticate(action, settings);
        const zone = compute.zone(zoneString);

        const config = {
            os: action.params.OS,
            disks: [],
            canIpForward : action.params.canIpForward
        };

        if (action.params.IMAGE) {

            let initializeParams = {
                sourceImage: action.params.IMAGE
            };

            if(action.params.diskType){
                initializeParams.diskType = `zones/${zoneString}/diskTypes/${action.params.diskType}`
            }

            config.disks.push({
                boot: true,
                initializeParams: initializeParams
            })
        }

        if (action.params.preemptible){
            config.scheduling = {
                preemptible: true
            };
        }

        if (action.params.networkInterfaces){
            if (!Array.isArray(action.params.networkInterfaces))
                return reject(new Error("Network interfaces must be an array."));
            config.networkInterfaces = action.params.networkInterfaces;
        } else if (action.params.NETWORK) {
            if (!action.params.SUBNET || !action.params.NETIP){
                return reject(new Error("You must specify subnet and ip to use specific VPC"));
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
                return reject(new Error("Labels object must be an object"));
            config.labels = action.params.LABELS;
        }

        if (action.params.MACHINE_TYPE) {
            config.machineType = action.params.MACHINE_TYPE;
        }

        zone.createVM(action.params.NAME, config, _gcpCallback(action,resolve,reject));
    });
}

function deleteUpdateRestartInstance(action, settings) {
    return new Promise((resolve, reject) => {
        const compute = authenticate(action, settings);

        let zone = compute.zone(action.params.ZONE);
        let name = action.params.NAME;
        const vm = zone.vm(name);

        switch (action.method.name) {
            case 'STOP_INSTANCE':
                return vm.stop();
            case 'DELETE_INSTANCE':
                return vm.delete();
            case 'RESET_INSTANCE':
                return vm.reset();
            default:
                throw new Error("Unknown method");
        }

    }).then(data => new Promise((resolve, reject) => {
        console.log(data[0]);
        resolve(data[1]);
    }));
}

function getExternalIP(action, settings) {
    return new Promise((resolve, reject) => {
        const compute = authenticate(action, settings);
        let zone = compute.zone(action.params.ZONE);
        let name = action.params.NAME;
        const vm = zone.vm(name);

        vm.getMetadata().then((data) => {
            if ((((((data[0] || {}).networkInterfaces || [])[0] || {}).accessConfigs || [])[0] || {}).natIP) {
                resolve(data[0].networkInterfaces[0].accessConfigs[0].natIP);
            } else {
                reject('No external IP');
            }
        });
    });
}

function createVpc(action, settings) {
    return new Promise((resolve, reject) => {
        let compute = authenticate(action, settings);

        let name = action.params.NAME;
        let network = compute.network(name);
        let config = {
            autoCreateSubnetworks: false
        };
        network.create(config, _gcpCallback(action,resolve,reject));
    })
}

function createSubnet(action, settings) {
    return new Promise((resolve, reject) => {
        let compute = authenticate(action, settings);

        let netID = action.params.NETID;
        let subName = action.params.SUBNAME;
        let network = compute.network(netID);
        let config = {
            region: action.params.REGION,
            range: action.params.IPRANGE
        };
        network.createSubnetwork(subName, config, _gcpCallback(action,resolve,reject));
    })
}

function reserveIp(action, settings) {
    return new Promise((resolve, reject) => {
        let compute = authenticate(action, settings);
        let resName = action.params.RESNAME;
        let region = compute.region(action.params.REGION);
        let config = {
            subnetwork: 'regions/' + action.params.REGION + '/subnetworks/' + action.params.SUBNAME,
            addressType: 'INTERNAL',
            address: action.params.RESIP
        };
        function callback(err, network, operation, apiResponse) {
            if (err)
                return reject(err);
            resolve(apiResponse);
        }
        region.createAddress(resName, config, callback);

    })
}

function createFW(action, settings) {
    return new Promise((resolve, reject) => {
        let compute = authenticate(action, settings);
        let firewall = compute.firewall(action.params.FWNAME);
        let config = {
            network: undefined, // Default : /global/networks/default
            destinationRanges: [],
            sourceRanges: [],
            allowed : []
        };

        if (action.params.NETNAME) {
            config.network = `projects/${action.params.PROJECT}/global/networks/${action.params.NETNAME}`;
        }

        if (action.params.ALLOWEDPROTOCOL) {
            config.allowed.push({
                IPProtocol: action.params.ALLOWEDPROTOCOL,
                ports: [
                    action.params.ALLOWEDPORT
                ]
            })
        } else {
            config.allowed.push({
                IPProtocol: "all",
                ports: []
            })
        }

        if (action.params.SOURCERANGE) {
            config.sourceRanges = _stringArrayParamHandler(action.params.SOURCERANGE, 'Source Ranges');
        }

        if (action.params.DESTRANGE) {
            config.destinationRanges = _stringArrayParamHandler(action.params.DESTRANGE, 'Destination Ranges');
        }

        if (action.params.DENIEDPROTOCOL) {
            if (!config.denied) config.denied = [];
            config.denied = [
                {
                    IPProtocol: action.params.DENIEDPROTOCOL,
                    ports: [
                        action.params.DENIEDPORT
                    ]
                }
            ]
        }

        firewall.create(config, (err, firewall, operation, apiResponse) => {
            if (err)
                return reject(err);
            resolve(apiResponse);
        });
    })
}

function createRoute(action, settings) {
    return new Promise((resolve, reject) => {
        let keys = _getCredentials(action, settings);

        const client = new JWT(
            keys.client_email,
            null,
            keys.private_key,
            ['https://www.googleapis.com/auth/cloud-platform'],
        );

        let request = {
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
        let compute = google.compute('v1');
        compute.routes.insert(request, function (err, res) {
            if (err)
                return reject(err);
            resolve(res)
        })
    })
}

module.exports = {
    LAUNCH_INSTANCE: launchInstance,
    STOP_INSTANCE: deleteUpdateRestartInstance,
    DELETE_INSTANCE: deleteUpdateRestartInstance,
    RESTART_INSTANCE: deleteUpdateRestartInstance,
    GET_INSTANCE_EXTERNAL_IP: getExternalIP,
    createVpc: createVpc,
    createSubnet: createSubnet,
    reserveIp: reserveIp,
    createFW: createFW,
    createRoute: createRoute
};

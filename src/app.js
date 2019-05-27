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

        const compute = authenticate(action, settings);
        const zone = compute.zone(action.params.ZONE);

        const config = {
            os: action.params.OS,
            disks: []
        };
        if (action.params.IMAGE) {
            config.disks.push({
                boot: true,
                initializeParams: {
                    sourceImage: action.params.IMAGE,
                }
            })
        }
        if (action.params.NETWORK) {
            config.networkInterfaces = [
                {
                    network: action.params.NETWORK,
                    subnetwork: action.params.SUBNET,
                    networkIP: action.params.NETIP
                }
            ]
        }

        if (action.params.TAGS) {
            config.tags = _stringArrayParamHandler(action.params.TAGS, 'Tags');
        }

        if (action.params.MACHINE_TYPE) {
            config.machineType = action.params.MACHINE_TYPE;
        }

        zone.createVM(action.params.NAME, config, (err, vm, operation) => {
            if (err)
                return reject(err);

            // `operation` lets you check the status of long-running tasks.
            try {
                operation
                    .on('error', function (err) {
                        reject(err);
                    })
                    .on('running', function (metadata) {
                        console.log(JSON.stringify(metadata));
                    })
                    .on('complete', function (metadata) {
                        console.log("Virtual machine created!");
                        resolve(metadata);
                    });
            } catch (e) {
                reject(e);
            }
        });
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
        network.create(config, (err, network, operation, apiResponse) => {
            if (err)
                return reject(err);
            resolve(apiResponse);
        });
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
        network.createSubnetwork(subName, config, (err, network, operation, apiResponse) => {
            if (err)
                return reject(err);
            resolve(apiResponse);
        });
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

function createFW(action) {
    return new Promise((resolve, reject) => {
        let compute = authenticate(action, settings, true);
        let firewall = compute.firewall(action.params.FWNAME);
        let config = {
            network: undefined, // Default : /global/networks/default
            denied: [],
            allowed: [],
            destinationRanges: [],
            sourceRanges: []
        };

        if (action.params.NETNAME) {
            config.network = `/global/networks/${action.params.NETNAME}`
        }

        if (action.params.ALLOWEDPROTOCOL) {
            config.allowed.push({
                IPProtocol: action.params.ALLOWEDPROTOCOL,
                ports: [
                    action.params.ALLOWEDPORT
                ]
            })
        }

        if (action.params.SOURCERANGE) {
            config.sourceRanges = _stringArrayParamHandler(action.params.SOURCERANGE, 'Source Ranges');
        }

        if (action.params.DESTRANGE) {
            config.destinationRanges = _stringArrayParamHandler(action.params.DESTRANGE, 'Destination Ranges');
        }

        if (action.params.DENIEDPROTOCOL) {
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
                network: action.params.NETWORK,
                nextHopGateway: action.params.NEXTHOPEGW,
                destRange: action.params.DESTRANGE,
                priority: action.params.PRIORITY || '0'

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

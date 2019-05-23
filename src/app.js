const compute = require('@google-cloud/compute');

function authenticate(action, settings) {
    let projectId = action.params.PROJECT;
    let keysParam = action.params.CREDENTIALS || settings.CREDENTIALS;
    let credentials;

    if (typeof keysParam != 'string'){
        credentials = keysParam;
    } else {
        try{
            credentials = JSON.parse(keysParam)
        }catch(err){
            throw new Error("Invalid credentials JSON");
        }
    }
    return compute({
        projectId,
        credentials
    });
}

function launchInstance(action, settings) {
    return new Promise((resolve, reject) => {
        const gce = authenticate(action, settings);

        const zone = gce.zone(action.params.ZONE);

        const config = {
            os: action.params.OS,
        };
        if (action.params.IMAGE) {
            config.disks = {
                    initializeParams: {
                        boot: true,
                        sourceImage: action.params.IMAGE,
                    }
                }
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

        if (action.params.MACHINE_TYPE) {
            config.machineType = action.params.MACHINE_TYPE;
        }

        zone.createVM(action.params.NAME, config, (err, vm, operation) => {
            // `operation` lets you check the status of long-running tasks.
            try {

                operation
                    .on('error', function (err) {
                        reject(err);
                    })
                    .on('running', function (metadata) {
                        console.log(metadata);
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
        const gce = authenticate(action, settings);

        let zone = gce.zone(action.params.ZONE);
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
        const gce = authenticate(action, settings);

        let zone = gce.zone(action.params.ZONE);
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

module.exports = {
    LAUNCH_INSTANCE: launchInstance,
    STOP_INSTANCE: deleteUpdateRestartInstance,
    DELETE_INSTANCE: deleteUpdateRestartInstance,
    RESTART_INSTANCE: deleteUpdateRestartInstance,
    GET_INSTANCE_EXTERNAL_IP: getExternalIP,
    createVpc: createVpc,
    createSubnet: createSubnet,
    reserveIp: reserveIp
};



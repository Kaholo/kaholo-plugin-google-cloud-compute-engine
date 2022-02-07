const GoogleComputeService = require('./google-compute-service');
const parsers = require('./parsers');
const {removeUndefinedAndEmpty} = require('./helpers')

async function createInstance(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);

    const customCpu = parsers.number(action.params.customMachineCpuCount);
    const customMem = parsers.number(action.params.customMachineMem);
    let apmtTest = parsers.autocomplete(action.params.machineType);
    if (apmtTest === undefined) {
        throw "Please specify Machine Type."
    }
    // action.params.machineType.id is string "334002", action.params.machineType.value is string "e2-micro"
    let machineType = !isNaN(apmtTest) ? parsers.autocomplete(action.params.machineType.value) : apmtTest;
    if (machineType.includes('custom')) {
        if (!customCpu || !customMem) {
            throw "Must provide both CPU Count and memory size for custom machine type.";
        }
        machineType += `${customCpu}-${customMem}`;
    }
    else if (customCpu || customMem) {
        throw "Must be a custom machine type for specifying cpu count or memory size.";
    }

    const addedNetworkInterfaces = parsers.array(action.params.networkInterfaces);
    const net = parsers.autocomplete(action.params.network);
    const sub = parsers.autocomplete(action.params.subnetwork);
    const cip = parsers.string(action.params.customInternalIp);

    // create networkInterfaces  array which will be passed to the instanceResource obj
    let networkInterfaces = ([{
        network: net ? `${net}` : undefined,
        subnetwork: sub ? `${sub}` : undefined,
        networkIP: cip ? `${cip}` : undefined
    }]).concat(addedNetworkInterfaces);

    // create tags array
    let tags = parsers.array(action.params.tags);
    tags = tags || [];
    if (parsers.boolean(action.params.allowHttp)) tags.push("http-server");
    if (parsers.boolean(action.params.allowHttps)) tags.push("https-server");

    // get all params, parse them
    let preemptible = parsers.boolean(action.params.preemptible);
    let diskType = action.params.diskType || "pd-standard";
    let zone = parsers.autocomplete(action.params.zone);
    let saAccessScopes = action.params.saAccessScopes || "default";
    let serviceAccount = parsers.autocomplete(action.params.serviceAccount);
    let name = parsers.string(action.params.name);
    let projectId = parsers.autocomplete(action.params.project);
    let region = parsers.autocomplete(action.params.region);

    // JSON representation of the instance which is going to be created
    const instanceResource = removeUndefinedAndEmpty({
        name,
        machineType: machineType ? `projects/${projectId}/zones/${zone}/machineTypes/${machineType}` : undefined,
        canIpForward: parsers.boolean(action.params.canIpForward),
        labels: parsers.object(action.params.labels),
        zone,
        region,
        description: parsers.string(action.params.description),
        scheduling: {
            automaticRestart: !preemptible,
            onHostMaintenance: preemptible ? "TERMINATE" : "MIGRATE",
            preemptible: preemptible || false
        },
        networkInterfaces: networkInterfaces ? networkInterfaces : undefined,
        tags: tags.length > 0 ? { items: tags } : undefined,
        disks: [{
            boot: true,
            initializeParams: {
                sourceImage: parsers.autocomplete(action.params.image),
                diskType: diskType ? `zones/${zone}/diskTypes/${diskType}` : undefined,
                diskSizeGb: parsers.number(action.params.diskSize) || 10
            },
            autoDelete: parsers.boolean(action.params.diskAutoDelete) || false,
            mode: "READ_WRITE",
            type: "PERSISTENT"
        }],
        serviceAccounts: serviceAccount ? [{
            email: serviceAccount,
            scopes: saAccessScopes == "default" ? [
                "https://www.googleapis.com/auth/devstorage.read_only",
                "https://www.googleapis.com/auth/logging.write",
                "https://www.googleapis.com/auth/monitoring.write",
                "https://www.googleapis.com/auth/servicecontrol",
                "https://www.googleapis.com/auth/service.management.readonly",
                "https://www.googleapis.com/auth/trace.append"] :
                saAccessScopes == "full" ?
                    ["https://www.googleapis.com/auth/cloud-platform"] :
                    saAccessScopes
        }] : undefined,
    });

    // create instance
    const createResult = await computeClient.createInstance(
        instanceResource,
        parsers.boolean(action.params.autoCreateStaticIP),
        parsers.boolean(action.params.waitForOperation)
    );

    return createResult;
}

async function vmAction(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);

    return computeClient.handleAction({
        action: action.params.action,
        zone: parsers.autocomplete(action.params.zone),
        instanceName: parsers.autocomplete(action.params.vm),
        startUpScript: parsers.text(action.params.startScript),
        project: parsers.autocomplete(action.params.project),
    }, 
    parsers.boolean(action.params.waitForOperation)
    )
}

async function createVpc(action, settings){
    const computeClient = GoogleComputeService.from(action.params, settings);

    try { 
        return await computeClient.createVPC({
            name: parsers.googleCloudName(action.params.name),
            description: parsers.string(action.params.description),
            autoCreateSubnetworks: parsers.boolean(action.params.autoCreateSubnetworks),
            project: parsers.autocomplete(action.params.project)
        }, parsers.boolean(action.params.waitForOperation)) 
    } catch (e) {
        throw e;
    }
}

async function deleteVM(action, settings){
    let resultArray = [];
    const computeClient = GoogleComputeService.from(action.params, settings);
    const isDeleteStaticIP = parsers.boolean(action.params.isDeleteStaticIP);

    try {
        if(isDeleteStaticIP) {
            const deleteStatus = await computeClient.deleteReservedExternalIP(parsers.autocomplete(action.params.region), parsers.autocomplete(action.params.vm, true))
            resultArray.push(deleteStatus)
        }

        const deleteResult = await computeClient.handleAction({
            zone: parsers.autocomplete(action.params.zone),
            instanceName: parsers.autocomplete(action.params.vm),
            project: parsers.autocomplete(action.params.project),
            action: 'Delete',
        },  parsers.boolean(action.params.waitForOperation))
        
        resultArray.push(deleteResult);
        
        return Promise.resolve(resultArray);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function createSubnet(action, settings){
    const computeClient = GoogleComputeService.from(action.params, settings);

    const subnetworkResource = removeUndefinedAndEmpty({
        network: parsers.autocomplete(action.params.network),
        name: parsers.googleCloudName(action.params.name),
        description: parsers.string(action.params.description),
        region: parsers.autocomplete(action.params.region),
        ipCidrRange: parsers.string(action.params.ipRange),
        privateIpGoogleAccess: parsers.boolean(action.params.privateGoogleAccess),
        enableFlowLogs: parsers.boolean(action.params.flowLogs)
    })

    try {   
        return await computeClient.createSubnetwork(subnetworkResource, parsers.boolean(action.params.waitForOperation));
    } catch (error) {
        throw error
    }
}

async function reservePrivateIp(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);

    const addressResource = removeUndefinedAndEmpty({
        name: parsers.string(action.params.resName),
        address: parsers.string(action.params.resIp),
        subnetwork: parsers.autocomplete(action.params.subnet),
        region: parsers.autocomplete(action.params.region),
        addressType: "INTERNAL",
        purpose: "GCE_ENDPOINT"
    });

    try {
        return await computeClient.createReservedInternalIP(addressResource, parsers.boolean(action.params.waitForOperation));   
    } catch (error) {
        throw error
    }
}

module.exports = {
    createInstance,
    vmAction,
    createVpc,
    deleteVM,
    createSubnet,
    reservePrivateIp,
    // autocomplete methods
    ...require("./autocomplete")
};

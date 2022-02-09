const GoogleComputeService = require('./google-compute-service');
const parsers = require('./parsers');
const { removeUndefinedAndEmpty } = require('./helpers')

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
    let name = parsers.googleCloudName(action.params.name);
    let projectId = parsers.autocomplete(action.params.project || settings.project);
    let region = parsers.autocomplete(action.params.region || settings.region);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

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
        waitForOperation
    );

    // create firewall rules
    if (parsers.boolean(action.params.allowHttp) || parsers.boolean(action.params.allowHttps)) {

        const n = net.lastIndexOf('/');
        const netshortname = net.substring(n + 1);

        let firewallResource = removeUndefinedAndEmpty({
            name: `${netshortname}-allow-http`,
            network: net,
            priority: 1000,
            destinationRanges: [],
            sourceRanges: ["0.0.0.0/0"],
            direction: "INGRESS",
            targetTags: ["http-server"],
            allowed: [{
                IPProtocol: 'tcp',
                ports: [80]
            }]
        });    

        try {
            const fwHttpResult = await computeClient.createFirewallRule(firewallResource, waitForOperation);
            } catch (error) {
            // throw error;
        }

        firewallResource["name"] = `${netshortname}-allow-https`;
        firewallResource["targetTags"] = ["https-server"];
        firewallResource["allowed"] = [{
            IPProtocol: 'tcp',
            ports: [443]
        }];
    
        try {
            const fwHttpsResult = await computeClient.createFirewallRule(firewallResource, waitForOperation);
            } catch (error) {
            // throw error;
        }
    }
    return createResult;
}

async function vmAction(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    return computeClient.handleAction({
        action: action.params.action,
        zone: parsers.autocomplete(action.params.zone),
        instanceName: parsers.autocomplete(action.params.vm),
        startUpScript: parsers.text(action.params.startScript),
        project: parsers.autocomplete(action.params.project || settings.project),
    },
        waitForOperation
    )
}

async function createVpc(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    const networkResource = removeUndefinedAndEmpty({
        name: parsers.googleCloudName(action.params.name),
        description: parsers.string(action.params.description),
        autoCreateSubnetworks: parsers.boolean(action.params.autoCreateSubnetworks)
    });

    try {
        return await computeClient.createVPC(networkResource, waitForOperation)
    } catch (e) {
        throw e;
    }
}

async function deleteVM(action, settings) {
    let resultArray = [];
    const computeClient = GoogleComputeService.from(action.params, settings);
    const isDeleteStaticIP = parsers.boolean(action.params.isDeleteStaticIP);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    try {
        if (isDeleteStaticIP) {
            const addressResource = {
                // this need to be fixed, right now isDeleteStaticIP flag deletes only those IP addresses which were created while VM was created using Launch VM method via Kaholo.
                name: `${parsers.autocomplete(action.params.vm, true)}-ext-addr`,
                region: parsers.autocomplete(action.params.region || settings.region),
                project: parsers.autocomplete(action.params.project || settings.project)
            }

            const deleteStatus = await computeClient.deleteReservedExternalIP(addressResource, true)
            resultArray.push(deleteStatus)
        }

        const deleteResult = await computeClient.handleAction({
            zone: parsers.autocomplete(action.params.zone),
            instanceName: parsers.autocomplete(action.params.vm),
            project: parsers.autocomplete(action.params.project || settings.project),
            action: 'Delete',
        }, waitForOperation)

        resultArray.push(deleteResult);

        return Promise.resolve(resultArray);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function createSubnet(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    const subnetworkResource = removeUndefinedAndEmpty({
        network: parsers.autocomplete(action.params.network),
        name: parsers.googleCloudName(action.params.name),
        description: parsers.string(action.params.description),
        region: parsers.autocomplete(action.params.region || settings.region),
        ipCidrRange: parsers.string(action.params.ipRange),
        privateIpGoogleAccess: parsers.boolean(action.params.privateGoogleAccess),
        enableFlowLogs: parsers.boolean(action.params.flowLogs)
    })

    try {
        return await computeClient.createSubnetwork(subnetworkResource, waitForOperation);
    } catch (error) {
        throw error
    }
}

async function reservePrivateIp(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    const addressResource = removeUndefinedAndEmpty({
        name: parsers.googleCloudName(action.params.resName),
        address: parsers.string(action.params.resIp),
        subnetwork: parsers.autocomplete(action.params.subnet),
        region: parsers.autocomplete(action.params.region || settings.region),
        addressType: "INTERNAL",
        purpose: "GCE_ENDPOINT"
    });

    try {
        return await computeClient.createReservedInternalIP(addressResource, waitForOperation);
    } catch (error) {
        throw error
    }
}

async function createFw(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    let name = parsers.googleCloudName(action.params.name),
        network = parsers.autocomplete(action.params.network),
        priority = parsers.number(action.params.priority) || 1000,
        direction = action.params.direction || "INGRESS",
        actionFw = action.params.action || "allow",
        ipRange = parsers.array(action.params.ipRanges) || "0.0.0.0/0",
        protocol = action.params.protocol || "all",
        ports = parsers.array(action.params.ports),
        tags = parsers.array(action.params.tags);


    let firewallResource = removeUndefinedAndEmpty({
        name,
        network,
        priority: priority || 1000,
        destinationRanges: [],
        sourceRanges: [],
        direction: direction || "INGRESS"
    });

    if (["tcp", "udp", "sctp"].includes(protocol)) {
        if (ports == undefined || ports.length == 0) {
            throw "Port ranges must be specified for rules using protocols TPC, UDP, and SCTP.";
        }
    }
    else {
        if (ports != undefined && ports.length != 0) {
            throw "Port ranges may be specified only for protocols TCP, UDP, and SCTP.";
        }
    }

    const fwRule = [{
        IPProtocol: protocol || 'all',
        ports
    }];
    if (fwRule) firewallResource[!actionFw || actionFw === "allow" ? "allowed" : "denied"] = fwRule;

    if (ipRange) firewallResource[firewallResource.direction === "INGRESS" ? "sourceRanges" : "destinationRanges"] = ipRange;

    tags = tags || [];
    if (tags.length > 0) firewallResource[firewallResource.direction === "INGRESS" ? "targetTags" : "sourceTags"] = tags;

    try {
        return await computeClient.createFirewallRule(firewallResource, waitForOperation);
    } catch (error) {
        throw error;
    }
}

async function createRoute(action, settings) {
    const computeClient = GoogleComputeService.from(action.params, settings);
    const waitForOperation = parsers.boolean(action.params.waitForOperation || settings.waitForOperation);

    // parse params
    let network = parsers.autocomplete(action.params.network),
        name = parsers.googleCloudName(action.params.name),
        nextHopIp = parsers.string(action.params.nextHopIp),
        destRange = parsers.string(action.params.destIpRange),
        priority = parsers.number(action.params.priority),
        tags = parsers.array(action.params.tags);

    // create routeResource
    let routeResource = {
        name,
        network,
        tags: tags && tags.length > 0 ? tags : undefined,
        destRange,
        priority: priority || 1000,
        nextHopIp
    }

    try {
        return await computeClient.createRoute(routeResource, waitForOperation);
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
    createFw,
    createRoute,
    // autocomplete methods
    ...require("./autocomplete")
};

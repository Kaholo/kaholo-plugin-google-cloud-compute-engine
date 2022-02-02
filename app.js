const GoogleComputeService = require('./google-compute-service');
const parsers = require('./parsers');


async function launchVm(action, settings) {
    const serviceClient = GoogleComputeService.from(action.params, settings);
    
    const customCpu = parsers.number(action.params.customMachineCpuCount);
    const customMem = parsers.number(action.params.customMachineMem);
    let apmtTest = parsers.autocomplete(action.params.machineType);
    if (apmtTest === undefined) {
        throw "Please specify Machine Type."
    }
    // action.params.machineType.id is string "334002", action.params.machineType.value is string "e2-micro"
    let machineType = !isNaN(apmtTest) ? parsers.autocomplete(action.params.machineType.value) : apmtTest;
    if (machineType.includes('custom')){
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

    let networkInterfaces = ([{
        network: net ? `${net}` : undefined, 
        subnetwork: sub ? `${sub}` : undefined, 
        networkIP: cip ? `${cip}` : undefined
    }]).concat(addedNetworkInterfaces);

    const vmResult = await serviceClient.launchVm({
        name: parsers.googleCloudName(action.params.name),
        description: parsers.string(action.params.description),
        region: parsers.autocomplete(action.params.region),
        zone: parsers.autocomplete(action.params.zone),
        machineType,
        sourceImage: parsers.autocomplete(action.params.image),
        diskType: action.params.diskType || "pd-standard",
        diskSizeGb: parsers.number(action.params.diskSize) || 10,
        diskAutoDelete: parsers.boolean(action.params.diskAutoDelete),
        serviceAccount: parsers.autocomplete(action.params.serviceAccount),
        saAccessScopes: action.params.saAccessScopes || "default",
        allowHttp: parsers.boolean(action.params.allowHttp),
        allowHttps: parsers.boolean(action.params.allowHttps),
        networkInterfaces,
        canIpForward: parsers.boolean(action.params.canIpForward),
        preemptible: parsers.boolean(action.params.preemptible),
        tags: parsers.array(action.params.tags),
        labels: parsers.object(action.params.labels),
        autoCreateStaticIP: parsers.boolean(action.params.autoCreateStaticIP)
    }, parsers.boolean(action.params.autoCreateStaticIP))

    let autoCreatedIp = parsers.boolean(action.params.autoCreateStaticIP)
    let resultArray=[]
    resultArray.push(vmResult)

    if (autoCreatedIp && ((vmResult.name).length>0)){
        const ipInfo = await serviceClient.getIpinfo({
            vm: parsers.string(action.params.name),
            zone: parsers.autocomplete(action.params.zone)
        })
        resultArray.push(ipInfo)

    }
    resultArray.forEach(item=>console.info(item))
    return 'Done'
}
 
async function vmAction(action, settings){
    const serviceClient = GoogleComputeService.from(action.params, settings);
    return serviceClient.vmAction({
        zoneStr: parsers.autocomplete(action.params.zone),
        vmName: parsers.autocomplete(action.params.vm),
        action: action.params.action,
        startupScript:  parsers.text(action.params.startupScript)
    }, parsers.boolean(action.params.waitForOperation));
}

async function deleteVM(action, settings){
    let resultArray=[]
    const serviceClient = GoogleComputeService.from(action.params, settings);
    const isDeleteStaticIP = parsers.boolean(action.params.isDeleteStaticIP)
    if(isDeleteStaticIP) {
        const deleteStatus= await serviceClient.deleteAutoExtIp(parsers.autocomplete(action.params.region), (action.params.vm.value)||(parsers.autocomplete(action.params.vm )))
        resultArray.push(deleteStatus)
    }
    const deleteResult=  await serviceClient.vmAction({
        zoneStr: parsers.autocomplete(action.params.zone),
        vmName: parsers.autocomplete(action.params.vm),
        action: 'Delete',
    },  parsers.boolean(action.params.waitForOperation))


    resultArray.push(deleteResult)
    resultArray.forEach(item=>console.info(item))
    return 'Done'
}

async function createVpc(action, settings){
    const serviceClient = GoogleComputeService.from(action.params, settings);
    try { 
        return await serviceClient.createVpc({
            name: parsers.googleCloudName(action.params.name),
            description: parsers.string(action.params.description),
            autoCreateSubnetworks: parsers.boolean(action.params.autoCreateSubnetworks)
        }, parsers.boolean(action.params.waitForOperation)) 
    } catch (e) {
        throw e;
    }
}

async function createSubnet(action, settings){
    const serviceClient = GoogleComputeService.from(action.params, settings);
    return serviceClient.createSubnet({
        networkId: parsers.autocomplete(action.params.network, true),
        name: parsers.googleCloudName(action.params.name),
        description: parsers.string(action.params.description),
        region: parsers.autocomplete(action.params.region, true),
        range: parsers.string(action.params.ipRange),
        privateIpGoogleAccess: parsers.boolean(action.params.privateGoogleAccess),
        enableFlowLogs: parsers.boolean(action.params.flowLogs)
    }, parsers.boolean(action.params.waitForOperation));
}

async function reserveIp(action, settings){
    const serviceClient = GoogleComputeService.from(action.params, settings);
    return serviceClient.reserveIp({
        subnet: parsers.autocomplete(action.params.subnet, true),
        name: parsers.string(action.params.resName),
        regionStr: parsers.autocomplete(action.params.region),
        address: parsers.string(action.params.resIp)
    }, parsers.boolean(action.params.waitForOperation));
}

async function createFw(action, settings){
    const serviceClient = GoogleComputeService.from(action.params, settings);
    const params = {
        networkId: parsers.autocomplete(action.params.network, true),
        name: parsers.string(action.params.name),
        priority: parsers.number(action.params.priority) || "1000",
        direction: action.params.direction || "INGRESS",
        action: action.params.action || "allow",
        ipRange: parsers.array(action.params.ipRanges).join(', ') || "0.0.0.0/0",
        protocol: action.params.protocol || "all",
        ports: parsers.array(action.params.ports),
        tags: parsers.array(action.params.tags)
    }

    if (["tcp","udp","sctp"].includes(params.protocol)) {
        if (params.ports == undefined || params.ports.length == 0) {
            throw "Port ranges must be specified for rules using protocols TPC, UDP, and SCTP.";
        }
    }
    else {
        if (params.ports != undefined && params.ports.length != 0) {
            throw "Port ranges may be specified only for protocols TCP, UDP, and SCTP.";
        }
    }

    return serviceClient.createFw(params, parsers.boolean(action.params.waitForOperation));
}

async function createRoute(action, settings){
    const serviceClient = GoogleComputeService.from(action.params, settings);
    return serviceClient.createRoute({
        networkId: parsers.autocomplete(action.params.network, true),
        name: parsers.googleCloudName(action.params.name),
        nextHopIp: parsers.string(action.params.nextHopIp),
        destRange: parsers.string(action.params.destIpRange),
        priority: parsers.number(action.params.priority),
        tags: parsers.array(action.params.tags)
    }, parsers.boolean(action.params.waitForOperation));
}

module.exports = {
    launchVm, 
    vmAction,
    createVpc,
    createSubnet,
    reserveIp, 
    createFw, 
    createRoute,
    deleteVM,
    // autocomplete methods
    ...require("./autocomplete")
};

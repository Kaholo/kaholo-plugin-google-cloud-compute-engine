const GoogleComputeService = require("./google-compute-service");
const parsers = require("./parsers");
const { removeUndefinedAndEmpty } = require("./helpers");
const autocomplete = require("./autocomplete");
const { prepareAddProjectMetadata } = require("./payload-functions");

async function createInstance(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);

  const customCpu = parsers.number(action.params.customMachineCpuCount);
  const customMem = parsers.number(action.params.customMachineMem);
  const apmtTest = parsers.autocomplete(action.params.machineType);
  if (apmtTest === undefined) {
    throw new Error("Please specify Machine Type.");
  }
  let machineType = !Number.isNaN(apmtTest)
    ? parsers.autocomplete(action.params.machineType.value)
    : apmtTest;

  if (machineType.includes("custom")) {
    if (!customCpu || !customMem) {
      throw new Error("Must provide both CPU Count and memory size for custom machine type.");
    }
    machineType += `${customCpu}-${customMem}`;
  } else if (customCpu || customMem) {
    throw new Error("Must be a custom machine type for specifying cpu count or memory size.");
  }

  const addedNetworkInterfaces = parsers.array(action.params.networkInterfaces);
  const net = parsers.autocomplete(action.params.network);
  const sub = parsers.autocomplete(action.params.subnetwork);
  const cip = parsers.string(action.params.customInternalIp);
  const networkTier = action.params.networkTier || "PREMIUM";

  // create networkInterfaces  array which will be passed to the instanceResource obj
  const networkInterfaces = ([{
    network: net ? `${net}` : undefined,
    subnetwork: sub ? `${sub}` : undefined,
    networkIP: cip ? `${cip}` : undefined,
    accessConfigs: [
      {
        networkTier,
      },
    ],
  }]).concat(addedNetworkInterfaces);

  // create tags array
  let tags = parsers.array(action.params.tags);
  tags = tags || [];
  if (parsers.boolean(action.params.allowHttp)) { tags.push("http-server"); }
  if (parsers.boolean(action.params.allowHttps)) { tags.push("https-server"); }

  // get all params, parse them
  const preemptible = parsers.boolean(action.params.preemptible);
  const { diskType } = action.params;
  const zone = parsers.autocomplete(action.params.zone);
  const saAccessScopes = action.params.saAccessScopes || "default";
  const serviceAccount = parsers.autocomplete(action.params.serviceAccount);
  const name = parsers.googleCloudName(action.params.name);
  const projectId = parsers.autocomplete(action.params.project || settings.project);
  const region = parsers.autocomplete(action.params.region || settings.region);
  const externalIPType = action.params.external_IP || "EPHEMERAL";
  const externalReservationName = parsers.googleCloudName(action.params.externalReservationName || `${name}-ext-addr`);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  switch (externalIPType) {
    case "NONE":
      break;

    case "EPHEMERAL":
      if (!networkInterfaces[0].accessConfigs) {
        networkInterfaces[0].accessConfigs = [{ natIP: undefined }];
      } else {
        networkInterfaces[0].accessConfigs[0].natIP = undefined;
      }
      break;

    case "RESERVE_STATIC_EXTERNAL":
      try {
        const { address: natIP } = await computeClient.createReservedExternalIP({
          name: externalReservationName,
          region,
          networkTier,
          addressType: "EXTERNAL",
        }, true);

        if (!networkInterfaces[0].accessConfigs) {
          networkInterfaces[0].accessConfigs = [{ natIP }];
        } else {
          networkInterfaces[0].accessConfigs[0].natIP = natIP;
        }
      } catch (error) {
        return Promise.reject(error);
      }

      break;

    case "USE_STATIC_EXTERNAL":
      try {
        const getResponse = await computeClient.getAddressResource(externalReservationName, region);
        if (!getResponse) {
          throw new Error(`Error: Reserved External Static IP with name '${externalReservationName}' was not found in region '${region}'!`);
        }

        if (!networkInterfaces[0].accessConfigs) {
          networkInterfaces[0].accessConfigs = [{ natIP: getResponse.address }];
        } else {
          networkInterfaces[0].accessConfigs[0].natIP = getResponse.address;
        }
      } catch (error) {
        return Promise.reject(error);
      }

      break;

    default:
      break;
  }

  // JSON representation of the instance which is going to be created
  const instanceResource = {
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
      preemptible: preemptible || false,
    },
    networkInterfaces: networkInterfaces || undefined,
    tags: tags.length > 0 ? { items: tags } : undefined,
    disks: [{
      boot: true,
      initializeParams: {
        sourceImage: parsers.autocomplete(action.params.image),
        diskType: diskType ? `zones/${zone}/diskTypes/${diskType}` : undefined,
        diskSizeGb: parsers.number(action.params.diskSize) || 10,
      },
      autoDelete: parsers.boolean(action.params.diskAutoDelete || settings.diskAutoDelete) || false,
      mode: "READ_WRITE",
      type: "PERSISTENT",
    }],
    serviceAccounts: serviceAccount && [{
      email: serviceAccount,
      scopes: saAccessScopes === "default" ? [
        "https://www.googleapis.com/auth/devstorage.read_only",
        "https://www.googleapis.com/auth/logging.write",
        "https://www.googleapis.com/auth/monitoring.write",
        "https://www.googleapis.com/auth/servicecontrol",
        "https://www.googleapis.com/auth/service.management.readonly",
        "https://www.googleapis.com/auth/trace.append"]
        : ["https://www.googleapis.com/auth/cloud-platform"],
    }],
  };

  // create instance
  const createResult = await computeClient.createInstance(
    instanceResource,
    waitForOperation,
  );

  // create firewall rules
  let instanceNetworkInterfaceName = net;
  if (!instanceNetworkInterfaceName) {
    const instanceInfo = await computeClient.getInstance({
      instance: name,
      project: projectId,
      zone,
    });
    instanceNetworkInterfaceName = instanceInfo.networkInterfaces[0].network;
  }
  const networkNameIndex = instanceNetworkInterfaceName.lastIndexOf("/");
  const networkShortName = instanceNetworkInterfaceName.substring(networkNameIndex + 1);

  const firewallResource = removeUndefinedAndEmpty({
    name: `${networkShortName}-allow-http`,
    network: instanceNetworkInterfaceName,
    priority: 1000,
    destinationRanges: [],
    sourceRanges: ["0.0.0.0/0"],
    direction: "INGRESS",
    targetTags: ["http-server"],
    allowed: [{
      IPProtocol: "tcp",
      ports: [80],
    }],
  });

  if (parsers.boolean(action.params.allowHttp)) {
    try {
      await computeClient.createFirewallRule(firewallResource, waitForOperation);
    } catch (error) {
      if (!error.message.includes("already exists")) { throw error; }
    }
  }

  if (parsers.boolean(action.params.allowHttps)) {
    firewallResource.name = `${networkShortName}-allow-https`;
    firewallResource.targetTags = ["https-server"];
    firewallResource.allowed = [{
      IPProtocol: "tcp",
      ports: [443],
    }];

    try {
      await computeClient.createFirewallRule(firewallResource, waitForOperation);
    } catch (error) {
      if (!error.message.includes("already exists")) { throw error; }
    }
  }

  return createResult;
}

async function vmAction(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);
  const waitForOperation = parsers.boolean(
    action.params.waitForOperation || settings.waitForOperation,
  );

  return computeClient.handleAction(
    {
      action: action.params.action,
      zone: parsers.autocomplete(action.params.zone),
      instanceName: parsers.autocomplete(action.params.vm),
      startUpScript: parsers.string(action.params.startupScript),
      addScriptFlag: parsers.boolean(action.params.addScript),
      project: parsers.autocomplete(action.params.project || settings.project),
    },
    waitForOperation,
  );
}

async function createVpc(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  const networkResource = removeUndefinedAndEmpty({
    name: parsers.googleCloudName(action.params.name),
    description: parsers.string(action.params.description),
    autoCreateSubnetworks: parsers.boolean(action.params.autoCreateSubnetworks),
  });

  try {
    const result = await computeClient.createVPC(networkResource, waitForOperation);
    return result;
  } catch (e) {
    return Promise.reject(e);
  }
}

async function deleteVM(action, settings) {
  const resultArray = [];
  const computeClient = GoogleComputeService.from(action.params, settings);
  const isDeleteStaticIP = parsers.boolean(action.params.isDeleteStaticIP);
  const instanceName = parsers.autocomplete(action.params.vm);
  const project = parsers.autocomplete(action.params.project || settings.project);
  const zone = parsers.autocomplete(action.params.zone);
  const region = parsers.autocomplete(action.params.region, true);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  if (isDeleteStaticIP) {
    const instance = await computeClient.getInstance({ instance: instanceName, project, zone });

    if (instance?.networkInterfaces[0]?.accessConfigs.length > 0) {
      const searchIP = instance.networkInterfaces[0].accessConfigs[0].natIP;

      const address = await computeClient.getAddressResourceByIP(searchIP, region, project);

      if (address) {
        address.region = region;
        const deleteAddressResponse = computeClient.deleteAddressResource(
          address,
          waitForOperation,
        );
        resultArray.push(deleteAddressResponse);
      }
    }
  }

  const deleteResult = computeClient.handleAction({
    zone,
    instanceName,
    project,
    action: "Delete",
  }, waitForOperation);

  resultArray.push(deleteResult);

  return Promise.all(resultArray);
}

async function createSubnet(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  const subnetworkResource = removeUndefinedAndEmpty({
    network: parsers.autocomplete(action.params.network),
    name: parsers.googleCloudName(action.params.name),
    description: parsers.string(action.params.description),
    region: parsers.autocomplete(action.params.region || settings.region),
    ipCidrRange: parsers.string(action.params.ipRange),
    privateIpGoogleAccess: parsers.boolean(action.params.privateGoogleAccess),
    enableFlowLogs: parsers.boolean(action.params.flowLogs),
  });

  try {
    const result = await computeClient.createSubnetwork(subnetworkResource, waitForOperation);
    return result;
  } catch (error) {
    return Promise.reject(error);
  }
}

async function reservePrivateIp(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  const addressResource = removeUndefinedAndEmpty({
    name: parsers.googleCloudName(action.params.resName),
    address: parsers.string(action.params.resIp),
    subnetwork: parsers.autocomplete(action.params.subnet),
    region: parsers.autocomplete(action.params.region || settings.region),
    addressType: "INTERNAL",
    purpose: "GCE_ENDPOINT",
  });

  try {
    const result = await computeClient.createReservedInternalIP(addressResource, waitForOperation);
    return result;
  } catch (error) {
    return Promise.reject(error);
  }
}

async function createFw(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  const name = parsers.googleCloudName(action.params.name);
  const network = parsers.autocomplete(action.params.network);
  const priority = parsers.number(action.params.priority) || 1000;
  const direction = action.params.direction || "INGRESS";
  const actionFw = action.params.action || "allow";
  const ipRange = parsers.array(action.params.ipRanges) || "0.0.0.0/0";
  const protocol = action.params.protocol || "all";
  const ports = parsers.array(action.params.ports);
  let tags = parsers.array(action.params.tags);

  const firewallResource = removeUndefinedAndEmpty({
    name,
    network,
    priority: priority || 1000,
    destinationRanges: [],
    sourceRanges: [],
    direction: direction || "INGRESS",
  });

  if (["tcp", "udp", "sctp"].includes(protocol)) {
    if (ports === undefined || ports.length === 0) {
      throw new Error("Port ranges must be specified for rules using protocols TPC, UDP, and SCTP.");
    }
  } else if (ports !== undefined && ports.length !== 0) {
    throw new Error("Port ranges may be specified only for protocols TCP, UDP, and SCTP.");
  }

  const fwRule = [{
    IPProtocol: protocol || "all",
    ports,
  }];
  if (fwRule) { firewallResource[!actionFw || actionFw === "allow" ? "allowed" : "denied"] = fwRule; }

  if (ipRange) { firewallResource[firewallResource.direction === "INGRESS" ? "sourceRanges" : "destinationRanges"] = ipRange; }

  tags = tags || [];
  if (tags.length > 0) { firewallResource[firewallResource.direction === "INGRESS" ? "targetTags" : "sourceTags"] = tags; }

  try {
    const result = await computeClient.createFirewallRule(firewallResource, waitForOperation);
    return result;
  } catch (error) {
    return Promise.reject(error);
  }
}

async function createRoute(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);
  const waitForOperation = parsers.boolean(action.params.waitForOperation
    || settings.waitForOperation);

  // parse params
  const network = parsers.autocomplete(action.params.network);
  const name = parsers.googleCloudName(action.params.name);
  const nextHopIp = parsers.string(action.params.nextHopIp);
  const destRange = parsers.string(action.params.destIpRange);
  const priority = parsers.number(action.params.priority);
  const tags = parsers.array(action.params.tags);

  // create routeResource
  const routeResource = {
    name,
    network,
    tags: tags && tags.length > 0 ? tags : undefined,
    destRange,
    priority: priority || 1000,
    nextHopIp,
  };

  try {
    const result = await computeClient.createRoute(routeResource, waitForOperation);
    return result;
  } catch (error) {
    return Promise.reject(error);
  }
}

async function listSubnets(action, settings) {
  const computeClient = GoogleComputeService.from(action.params, settings);

  const subnets = await computeClient.listSubnetworks(action.params, false);

  return subnets;
}

async function addProjectMetadata({ params }, settings) {
  const computeClient = GoogleComputeService.from(params, settings);
  const payload = prepareAddProjectMetadata(params);
  return computeClient.setCommonInstanceMetadata(payload);
}

async function listFirewallRules({ params }, settings) {
  const computeClient = GoogleComputeService.from(params, settings);
  const firewallRules = await computeClient.listFirewallRules({
    vpc: params.vpcNetwork.id,
  });
  return firewallRules;
}

module.exports = {
  launchVm: createInstance,
  vmAction,
  createVpc,
  deleteVM,
  createSubnet,
  reserveIp: reservePrivateIp,
  createFw,
  createRoute,
  listSubnets,
  addProjectMetadata,
  listFirewallRules,
  // autocomplete methods
  ...autocomplete,
};

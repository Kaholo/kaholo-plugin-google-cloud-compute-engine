const compute = require("@google-cloud/compute");
const { RegionOperationsClient } = require("@google-cloud/compute");
const { ProjectsClient } = require("@google-cloud/resource-manager");
const { JWT } = require("google-auth-library");
const { google } = require("googleapis");

const iam = google.iam("v1");
const { removeUndefinedAndEmpty } = require("./helpers");
const parsers = require("./parsers");

/** Class for using the google cloud compute API. */
module.exports = class GoogleComputeService {
  /**
     * Create a Google Cloud Compute service instance
     * @param {object} credentials The credentials of a service account to use to make the request
     * @param {string} projectId The ID of the project to make all the requests about.
     */
  constructor(credentials, projectId) {
    this.projectId = projectId;
    this.credentials = credentials;
  }

  /**
     * Get Google Compute Service Client from Kaholo action and settings objects
     * @param {object} params Kaholo Action Params Object
     * @param {string} settings Kaholo Settings Object
     * @return {GoogleComputeService} The Google Compute Service Client
     */
  static from(params, settings) {
    const creds = parsers.object(params.creds || settings.creds);
    if (!creds) { throw new Error("Must provide credentials to call any method in the plugin!"); }
    const project = parsers.autocomplete(params.project || settings.project) || undefined;
    return new GoogleComputeService(creds, project);
  }

  getAuthClient() {
    return new JWT(
      this.credentials.client_email,
      null,
      this.credentials.private_key,
      ["https://www.googleapis.com/auth/cloud-platform"],
    );
  }

  /**
    * Create and reserve external IP address for the specified region in `addressResource`.
    * @param {Object} addressResource Address object which needs to be created.
    * @param {boolean} waitForOperation Flag whether to wait for operation to complete.
    * @return {Promise<cloud.compute.v1.IAddress>} Created Adrress Resource
    */
  async createReservedExternalIP(addressResource, waitForOperation) {
    try {
      const getResult = await this.getAddressResource(addressResource.name, addressResource.region);
      if (getResult && getResult.addressType === "EXTERNAL") { return getResult; }

      const createAddress = await this.createAddressResource(addressResource, waitForOperation);

      return createAddress;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
    * Delte reserved external IP address.
    * @param {Object} addressResource Address object which needs to be deleted.
    * @param {boolean} waitForOperation Flag whether to wait for operation to complete.
    * @return {Promise<string>} Status/Operation of the methods completeion.
    */
  async deleteReservedExternalIP(addressResource, waitForOperation) {
    const request = removeUndefinedAndEmpty({
      project: addressResource.project || this.projectId,
      region: addressResource.region,
      address: addressResource.name,
    });

    try {
      const addressesClient = new compute.AddressesClient({ credentials: this.credentials });
      let [operation] = await addressesClient.delete(request);

      // wait for the operation to end
      if (waitForOperation) {
        const operationsClient = new RegionOperationsClient({ credentials: this.credentials });
        /* eslint-disable no-await-in-loop */
        /* eslint-disable no-restricted-syntax */
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
            region: addressResource.region,
          });
        }

        return operation.status;
      }

      return operation;
    } catch (err) {
      throw new Error(`Couldn't delete external address with the name: ${addressResource.name}\n${err.message || JSON.stringify(err)}`);
    }
  }

  async createReservedInternalIP(addressResource, waitForOperation) {
    try {
      const createAddress = await this.createAddressResource(addressResource, waitForOperation);

      return createAddress;
    } catch (err) {
      throw new Error(`Couldn't create internal address with the name: ${addressResource.name}\n${err.message || JSON.stringify(err)}`);
    }
  }

  /**
     * This method creates address resource in the specified region in the body of
     * `addressResource` argument.
     * @param {google.cloud.compute.v1.IAddress} addressResource JSON representation of
     * the address to be created
     * @param {boolean} waitForOperation Flag whether to wait for the Long-Running
     * operation to end or not.
     * @returns {google.cloud.compute.v1.IAddress} `IAddress` if passed `addressResource`
     * was successfully created.
     * @returns {google.cloud.compute.v1.IOperation} If `waitForOperation` false,
     * Long-Running operation is returned.
     */
  async createAddressResource(addressResource, waitForOperation) {
    const addressesClient = new compute.AddressesClient({ credentials: this.credentials });

    try {
      const getAddress = await this.getAddressResource(
        addressResource.name,
        addressResource.region,
      );
      if (getAddress) {
        throw Error(`Error: ${getAddress.addressType} Address Resource with the name ${getAddress.name} already exists in region ${addressResource.region}!`);
      }

      let [operation] = await addressesClient.insert({
        addressResource,
        project: this.projectId,
        region: addressResource.region,
      });

      // wait for the operation to end
      if (waitForOperation) {
        const operationsClient = new compute.RegionOperationsClient({
          credentials: this.credentials,
        });

        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
            region: addressResource.region,
          });
        }

        // get the result of operation
        const [response] = await addressesClient.get({
          address: addressResource.name,
          project: this.projectId,
          region: addressResource.region,
        });

        return response;
      }

      return operation;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async getAddressResource(address, region) {
    const addressesClient = new compute.AddressesClient({ credentials: this.credentials });

    try {
      const [response] = await addressesClient.get({ address, project: this.projectId, region });

      return response;
    } catch (error) {
      // if the reason is notFound return undefined
      if (error && error.errors && error.errors.length > 0 && error.errors[0].reason === "notFound") { return undefined; }

      // if error is smth else, throw it
      throw error;
    }
  }

  /**
    * Create a new VM instance
    * @param {compute.protos.google.cloud.compute.v1.IInstance} instanceResource JSON
    * representation of the instance which need to be created
    * @param {boolean} createReservedExtIP If true creates and reserves static external IP.
    * If false External IP is not present at all (for this version);
    * @param {boolean} waitForOperation Whether to wait for the operation to finish before returning
    * @return {Promise} Information about the instance if succeded, Error in the other case.
    */
  async createInstance(instanceResource, waitForOperation) {
    const instancesClient = new compute.InstancesClient({ credentials: this.credentials });

    try {
      // return Long-Running operation
      let [operation] = await instancesClient.insert({
        instanceResource,
        project: this.projectId,
        zone: instanceResource.zone,
      });

      if (waitForOperation) {
        const operationsClient = new compute.ZoneOperationsClient({
          credentials: this.credentials,
        });

        // Wait for the create operation to complete.
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
            zone: instanceResource.zone,
          });
        }

        if (operation?.error?.errors?.length > 0) {
          return Promise.reject(operation.error);
        }

        // get instance after creation
        const [response] = await instancesClient.get({
          instance: instanceResource.name,
          project: this.projectId,
          zone: instanceResource.zone,
        });

        return Promise.resolve(response);
      }

      return Promise.resolve(operation);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async handleAction({
    action, zone, instanceName, startUpScript, project,
  }, waitForOperation) {
    const instancesClient = new compute.InstancesClient({ credentials: this.credentials });

    const request = removeUndefinedAndEmpty({
      instance: instanceName,
      project: project || this.projectId,
      zone,
    });

    let res = [];

    try {
      switch (action) {
        case "Stop":
          res = await instancesClient.stop(request);
          break;
        case "Delete":
          res = await instancesClient.delete(request);
          break;
        case "Restart":
          res = await instancesClient.reset(request);
          break;
        case "Start": {
          let startScript = "";

          if (startUpScript) {
            await instancesClient.stop(request);
            startUpScript.forEach((item) => { startScript += `${item}\n`; });
            const startUpScriptMetadata = {
              key: "startup-script",
              value: startScript,
            };
            await instancesClient.setMetadata({
              ...request,
              metadataResource: { items: [startUpScriptMetadata] },
            });
          }

          res = await instancesClient.start(request);
          break;
        }
        case "Get":
          return this.getInstance(request);
        case "Get-IP": {
          const instance = await this.getInstance(request);
          if (!instance.networkInterfaces || !instance.networkInterfaces[0].accessConfigs
            || !instance.networkInterfaces[0].accessConfigs[0].natIP) {
            throw new Error("No external IP found");
          }
          return instance.networkInterfaces[0].accessConfigs[0].natIP;
        }
        default:
          throw new Error("Must provide an action to run on the VM instance!");
      }
    } catch (error) {
      return Promise.reject(error);
    }

    try {
      if (waitForOperation) {
        const operationsClient = new compute.ZoneOperationsClient({
          credentials: this.credentials,
        });
        let operation = res[0];

        // Wait for the operation to complete.
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: project || this.projectId,
            zone,
          });
        }

        // get instance after creation
        if (action !== "Delete") {
          const instance = await this.getInstance(request);
          return Promise.resolve(instance);
        }

        return Promise.resolve(operation);
      }

      return Promise.resolve(res[0]);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async createVPC(networkResource, waitForOperation) {
    const networksClient = new compute.NetworksClient({ credentials: this.credentials });

    try {
      let [operation] = await networksClient.insert({ networkResource, project: this.projectId });

      if (waitForOperation) {
        const operationsClient = new compute.GlobalOperationsClient({
          credentials: this.credentials,
        });

        // Wait for the create operation to complete.
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
          });
        }

        // get network after creation
        const [response] = await networksClient.get({
          network: networkResource.name,
          project: this.projectId,
        });

        return Promise.resolve(response);
      }

      return Promise.resolve(operation);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async createSubnetwork(subnetworkResource, waitForOperation) {
    const subnetworksClient = new compute.SubnetworksClient({
      credentials: this.credentials,
    });

    const request = removeUndefinedAndEmpty({
      project: this.projectId,
      region: subnetworkResource.region,
      subnetworkResource,
    });

    try {
      // return Long-Running operation
      let [operation] = await subnetworksClient.insert(request);

      if (waitForOperation) {
        const operationsClient = new compute.RegionOperationsClient({
          credentials: this.credentials,
        });

        // Wait for the create operation to complete.
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
            region: subnetworkResource.region,
          });
        }

        // get subnetwork after creation
        const [response] = await subnetworksClient.get({
          subnetwork: subnetworkResource.name,
          project: this.projectId,
          region: subnetworkResource.region,
        });

        return Promise.resolve(response);
      }

      return Promise.resolve(operation);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async createFirewallRule(firewallResource, waitForOperation) {
    const firewallClient = new compute.FirewallsClient({ credentials: this.credentials });

    const request = {
      firewallResource,
      project: this.projectId,
    };

    try {
      const getFirewall = await this.getFirewallRule(firewallResource.name);
      if (getFirewall) { throw Error(`Error: Firewall Rule with the name ${firewallResource.name} already exists!`); }

      let [operation] = await firewallClient.insert(request);

      if (waitForOperation) {
        const operationsClient = new compute.GlobalOperationsClient({
          credentials: this.credentials,
        });

        // Wait for the create operation to complete.
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
          });
        }

        // get subnetwork after creation
        const [response] = await firewallClient.get({
          firewall: firewallResource.name,
          project: this.projectId,
        });

        return Promise.resolve(response);
      }

      return Promise.resolve(operation);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async createRoute(routeResource, waitForOperation) {
    const routesClient = new compute.RoutesClient({ credentials: this.credentials });

    const request = removeUndefinedAndEmpty({
      project: this.projectId,
      routeResource,
    });

    try {
      let [operation] = await routesClient.insert(request);

      if (waitForOperation) {
        const operationsClient = new compute.GlobalOperationsClient({
          credentials: this.credentials,
        });

        // Wait for the create operation to complete.
        while (operation.status !== "DONE") {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: this.projectId,
          });
        }

        // get subnetwork after creation
        const [response] = await routesClient.get({
          route: routeResource.name,
          project: this.projectId,
        });

        return Promise.resolve(response);
      }

      return Promise.resolve(operation);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // try to get firewall rule, if it exists return it, if no return undefined
  async getFirewallRule(firewall) {
    const firewallClient = new compute.FirewallsClient({ credentials: this.credentials });

    try {
      const [getResponse] = await firewallClient.get({
        firewall,
        project: this.projectId,
      });

      return getResponse;
    } catch (error) {
      // if the reason is notFound return undefined
      if (error && error.errors && error.errors.length > 0 && error.errors[0].reason === "notFound") { return undefined; }

      // if error is smth else, throw it
      throw error;
    }
  }

  async getInstance({ instance, project, zone }) {
    const instancesClient = new compute.InstancesClient({ credentials: this.credentials });

    const request = removeUndefinedAndEmpty({
      instance,
      project,
      zone,
    });

    try {
      const [response] = await instancesClient.get(request);

      return response;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async listProjects(params) {
    const projectsClient = new ProjectsClient({ credentials: this.credentials });
    const { query } = params;

    const request = removeUndefinedAndEmpty({
      query: query ? `name:*${query}*` : undefined,
    });

    const iterable = projectsClient.searchProjectsAsync(request);
    const res = [];

    try {
      for await (const proj of iterable) {
        res.push(proj);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res;
  }

  async listRegions() {
    const regionsClient = new compute.RegionsClient({ credentials: this.credentials });

    const request = removeUndefinedAndEmpty({
      project: this.projectId,
    });

    const iterable = regionsClient.listAsync(request);
    const res = [];

    try {
      for await (const region of iterable) {
        res.push(region);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res;
  }

  async listZones(params) {
    const zonesClient = new compute.ZonesClient({ credentials: this.credentials });
    const region = parsers.autocomplete(params.region);

    const request = removeUndefinedAndEmpty({
      project: this.projectId,
      // filter: `name:${region}`
    });

    const iterable = zonesClient.listAsync(request);
    const res = [];

    try {
      for await (const zone of iterable) {
        res.push(zone);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res.filter((zone) => !region || zone.name.includes(region));
  }

  async listMachineTypes(params) {
    const machineTypesClient = new compute.MachineTypesClient({ credentials: this.credentials });
    const zone = parsers.autocomplete(params.zone);
    const project = parsers.autocomplete(params.project) || this.projectId;

    const request = removeUndefinedAndEmpty({
      project,
      zone,
    });

    const iterable = machineTypesClient.listAsync(request);
    const res = [
      { id: "custom-", name: "Custom N1(Default Custom)" },
      { id: "n2-custom-", name: "Custom N2" },
      { id: "n2d-custom-", name: "Custom N2D" },
      { id: "e2-custom-", name: "Custom E2" },
    ];

    try {
      for await (const machine of iterable) {
        res.push(machine);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res;
  }

  async listImageProjects(params) {
    const userProjects = await this.listProjects(params);
    return [...userProjects,
      { displayName: "Debian Cloud", projectId: "debian-cloud" },
      { displayName: "Windows Cloud", projectId: "windows-cloud" },
      { displayName: "Ubuntu Cloud", projectId: "ubuntu-os-cloud" },
      { displayName: "Ubuntu Pro Cloud", projectId: "ubuntu-os-pro-cloud" },
      { displayName: "Google UEFI(CentOS|COS) Images", projectId: "gce-uefi-images" },
      { displayName: "Machine Learning Images", projectId: "ml-images" },
      { displayName: "Fedora CoreOS Cloud", projectId: "fedora-coreos-cloud" },
      { displayName: "Windows SQL Cloud", projectId: "windows-sql-cloud" },
      { displayName: "Windows Cloud", projectId: "windows-cloud" },
      { displayName: "Red Hat Enterprise Linux SAP Cloud", projectId: "rhel-sap-cloud" },
      { displayName: "SUSE Cloud", projectId: "suse-cloud" },
      { displayName: "Rocky Linux Cloud", projectId: "rocky-linux-cloud" },
    ];
  }

  async listImages(params) {
    const imagesClient = new compute.ImagesClient({ credentials: this.credentials });
    const imageProject = parsers.autocomplete(params.imageProject);

    const request = removeUndefinedAndEmpty({
      project: imageProject || this.projectId,
      filter: "NOT deprecated:*",
    });

    const iterable = imagesClient.listAsync(request);
    const res = [];

    try {
      for await (const image of iterable) {
        res.push(image);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res;
  }

  async listServiceAccounts(params) {
    const project = parsers.autocomplete(params.project) || this.projectId;

    const request = removeUndefinedAndEmpty({
      auth: this.getAuthClient(),
      name: `projects/${project}`,
    });

    return (await iam.projects.serviceAccounts.list(request)).data.accounts;
  }

  async listNetworks(params) {
    const networksClient = new compute.NetworksClient({ credentials: this.credentials });
    const project = parsers.autocomplete(params.project) || this.projectId;

    const request = removeUndefinedAndEmpty({
      project,
    });

    const iterable = networksClient.listAsync(request);
    const res = [];

    try {
      for await (const network of iterable) {
        res.push(network);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res;
  }

  async listSubnetworks(params) {
    const subnetworksClient = new compute.SubnetworksClient({ credentials: this.credentials });
    const project = parsers.autocomplete(params.project) || this.projectId;
    const region = parsers.autocomplete(params.region);

    const request = removeUndefinedAndEmpty({
      project,
      region,
    });

    const iterable = subnetworksClient.listAsync(request);
    const res = [];

    try {
      for await (const subnetwork of iterable) {
        res.push(subnetwork);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    /* eslint-disable no-param-reassign */
    res.map((item) => { item.name += ` | ${item.ipCidrRange}`; return item; });
    /* eslint-enable no-param-reassign */

    return res;
  }

  async listInstances(params) {
    const instancesClient = new compute.InstancesClient({ credentials: this.credentials });
    const zone = parsers.autocomplete(params.zone);
    const project = parsers.autocomplete(params.project) || this.projectId;

    const request = removeUndefinedAndEmpty({
      project,
      zone,
    });

    const iterable = instancesClient.listAsync(request);
    const res = [];

    try {
      for await (const instance of iterable) {
        res.push(instance);
      }
    } catch (error) {
      return Promise.reject(error);
    }

    return res;
  }
};

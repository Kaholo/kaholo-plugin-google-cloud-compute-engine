const parsers = require("./parsers");
const GoogleComputeService = require("./google-compute-service");

// auto complete helper methods

const MAX_RESULTS = 100;

function mapAutoParams(autoParams) {
  const params = {};
  autoParams.forEach((param) => {
    params[param.name] = parsers.autocomplete(param.value);
  });
  return params;
}

function getAutoResult(id, value) {
  return {
    id: id || value,
    value: value || id,
  };
}

function getParseFromParam(idParamName, valParamName) {
  if (valParamName) { return (item) => getAutoResult(item[idParamName], item[valParamName]); }
  return (item) => getAutoResult(item[idParamName]);
}

function filterItems(items, query) {
  const itemsResult = items;
  if (query) {
    const qWords = query.split(/[. ]/g).map((word) => word.toLowerCase()); // split by '.' or ' ' and make lower case
    itemsResult.filter((item) => qWords.every((word) => item.value.toLowerCase().includes(word)));
    itemsResult.sort(
      (w1, w2) => w2.value.toLowerCase().indexOf(qWords[0])
        - w1.value.toLowerCase().indexOf(qWords[0]),
    );
  }
  return itemsResult.splice(0, MAX_RESULTS);
}

/** *
 * @returns {[{id, value}]} filtered result items
 ** */
function handleResult(result, query, parseFunc) {
  const items = result.map(parseFunc);
  return filterItems(items, query);
}

// HOF to generate autocomplete
function listAuto(listFunc, fields = ["id", "name"]) {
  const parseFunc = getParseFromParam(...fields);

  return async (query, pluginSettings, triggerParameters) => {
    const settings = mapAutoParams(pluginSettings); const
      params = mapAutoParams(triggerParameters);
    const client = GoogleComputeService.from(params, settings);

    const items = [];

    params.query = (query || "").trim();

    try {
      const result = await client[listFunc](params, fields);

      items.push(...handleResult(result.items || result, params.query, parseFunc));

      return items;
    } catch (err) {
      throw new Error(`Problem with '${listFunc}': ${err}`);
    }
  };
}

module.exports = {
  listProjectsAuto: listAuto("listProjects", ["projectId", "displayName"]),
  listRegionsAuto: listAuto("listRegions", ["name"]),
  listZonesAuto: listAuto("listZones", ["name"]),
  listMachineTypesAuto: listAuto("listMachineTypes", ["id", "name"]),
  listImageProjectsAuto: listAuto("listImageProjects", ["projectId", "displayName"]),
  listImagesAuto: listAuto("listImages", ["selfLink", "name"]),
  listServiceAccountsAuto: listAuto("listServiceAccounts", ["email", "displayName"]),
  listNetworksAuto: listAuto("listNetworks", ["selfLink", "name"]),
  listSubnetworksAuto: listAuto("listSubnetworks", ["selfLink", "name"]),
  listVmsAuto: listAuto("listInstances", undefined),
};

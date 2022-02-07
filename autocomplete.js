const parsers = require("./parsers");
const GoogleComputeService = require('./google-compute-service');

// auto complete helper methods

const MAX_RESULTS = 10;

function mapAutoParams(autoParams) {
  const params = {};
  autoParams.forEach(param => {
    params[param.name] = parsers.autocomplete(param.value);
  });
  return params;
}

/***
 * @returns {[{id, value}]} filtered result items
 ***/
function handleResult(result, query, parseFunc) {
  if (!parseFunc) parseFunc = getParseFromParam("id", "name");
  const items = result.map(parseFunc);
  return filterItems(items, query);
}

function getAutoResult(id, value) {
  return {
    id: id || value,
    value: value || id
  };
}

function getParseFromParam(idParamName, valParamName) {
  if (valParamName) return (item) => getAutoResult(item[idParamName], item[valParamName]);
  return (item) => getAutoResult(item[idParamName]);
}

function filterItems(items, query) {
  if (query) {
    const qWords = query.split(/[. ]/g).map(word => word.toLowerCase()); // split by '.' or ' ' and make lower case
    items = items.filter(item => qWords.every(word => item.value.toLowerCase().includes(word)));
    items = items.sort((word1, word2) => word1.value.toLowerCase().indexOf(qWords[0]) - word2.value.toLowerCase().indexOf(qWords[0]));
  }
  return items.splice(0, MAX_RESULTS);
}

// HOF to generate autocomplete
function listAuto(listFunc, fields, noProject, parseFunc) {
  // fileds to retrieve from the response
  if (!fields) fields = ["id", "name"];
  if (!parseFunc && fields) parseFunc = getParseFromParam(...fields);

  return async (query, pluginSettings, triggerParameters) => {
    const settings = mapAutoParams(pluginSettings), params = mapAutoParams(triggerParameters);
    const client = GoogleComputeService.from(params, settings, noProject);

    const items = [];

    query = (query || "").trim();

    params.query = query;

    try {
      let result = await client[listFunc](params, fields);

      items.push(...handleResult(result.items || result, query, parseFunc));

      return items;
    }
    catch (err) {
      throw `Problem with '${listFunc}': ${err}`;
    }
  }
}

module.exports = {
  listProjectsAuto: listAuto("listProjects", ["projectId", "displayName"], true),
  listRegionsAuto: listAuto("listRegions", ["name"]),
  listZonesAuto: listAuto("listZones", ["name"]),
  listMachineTypesAuto: listAuto("listMachineTypes", ["id", "name"]),
  listImageProjectsAuto: listAuto("listImageProjects", ["projectId", "displayName"]),
  listImagesAuto: listAuto("listImages", ["selfLink", "name"]),
  listServiceAccountsAuto: listAuto("listServiceAccounts", ["email", "displayName"]),
  listNetworksAuto: listAuto("listNetworks", ["selfLink", "name"]),
  listSubnetworksAuto: listAuto("listSubnetworks", ["selfLink", "name"]),
}
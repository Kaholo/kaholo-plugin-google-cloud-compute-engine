const parsers = require("./parsers");
const GoogleComputeService = require('./google-compute-service');

// auto complete helper methods

const MAX_RESULTS = 10;

function mapAutoParams(autoParams){
  const params = {};
  autoParams.forEach(param => {
    params[param.name] = parsers.autocomplete(param.value);
  });
  return params;
}

/***
 * @returns {[{id, value}]} filtered result items
 ***/
function handleResult(result, query, parseFunc){
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

function filterItems(items, query){
  if (query){
    const qWords = query.split(/[. ]/g).map(word => word.toLowerCase()); // split by '.' or ' ' and make lower case
    items = items.filter(item => qWords.every(word => item.value.toLowerCase().includes(word)));
    items = items.sort((word1, word2) => word1.value.toLowerCase().indexOf(qWords[0]) - word2.value.toLowerCase().indexOf(qWords[0]));
  }
  return items.splice(0, MAX_RESULTS);
}

function listAuto(listFunc, fields, paging, noProject, parseFunc) {
  if (!fields) fields = ["id", "name"];
  if (!parseFunc && fields) parseFunc = getParseFromParam(...fields);
  return async (query, pluginSettings, triggerParameters) => {
    const settings = mapAutoParams(pluginSettings), params = mapAutoParams(triggerParameters); 
    const client = GoogleComputeService.from(params, settings, noProject);
    const items = [];
    let nextPageToken;
    query = (query || "").trim();
    params.query = query;
    while (true){
      try {
        const result = await client[listFunc](params, fields, nextPageToken);
        items.push(...handleResult(result.items || result, query, parseFunc));
        if (!paging || !query || !result.nextPageToken || items.length >= MAX_RESULTS) return items;
        const exactMatch = items.find(item => item.value.toLowerCase() === query.toLowerCase() || 
                                              item.id.toLowerCase() === query.toLowerCase());
        if (exactMatch) return [exactMatch]
        nextPageToken = result.nextPageToken;
      }
      catch (err) {
        throw `Problem with '${listFunc}': ${err.message}`;
      }
    }
  }
}

async function listMachineTypesAuto(query, pluginSettings, triggerParameters){
  const settings = mapAutoParams(pluginSettings), params = mapAutoParams(triggerParameters); 
  const client = GoogleComputeService.from(params, settings);
  const nextPageToken = undefined;
  query = (query || "").trim();
  try {
    const items = filterItems([{id: "custom-", value: "Custom N1(Default Custom)"},
      {id: "n2-custom-", value: "Custom N2"}, 
      {id: "n2d-custom-", value: "Custom N2D"},
      {id: "e2-custom-", value: "Custom E2"}], query);
    if (query.toLowerCase().includes("custom")) return items;
    while (true){
    const result = await client.listMachineTypes(params, nextPageToken);
    items.push(...handleResult(result.items, query));
    if (!result.nextPageToken || !query || items.length >= MAX_RESULTS) return items;
    const exactMatch = items.find(item => item.value.toLowerCase() === query.toLowerCase() || 
                    item.id.toLowerCase() === query.toLowerCase());
    if (exactMatch) return [exactMatch]
    nextPageToken = result.nextPageToken;
    }
  }
  catch (err) {
    throw `Problem with 'listMachineTypesAuto': ${err.message}`;
  }
}

module.exports = {
  listProjectsAuto: listAuto("listProjects", ["projectId", "name"], false, true),
  listRegionsAuto: listAuto("listRegions", ["name"]),
  listZonesAuto: listAuto("listZones", ["name"]),
  listImageProjectsAuto: listAuto("listImageProjects", ["projectId", "name"], false, true),
  listImagesAuto: listAuto("listImages" , ["selfLink", "name"], true),
  listServiceAccountsAuto: listAuto("listServiceAccounts", ["email", "displayName"]),
  listNetworksAuto: listAuto("listNetworks", ["selfLink", "name"], true),
  listSubnetworksAuto: listAuto("listSubnetworks", ["selfLink", "name"], true),
  listVmsAuto: listAuto("listVms", undefined, true),
  listMachineTypesAuto
}
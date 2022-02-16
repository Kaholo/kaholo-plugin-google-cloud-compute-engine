/* eslint-disable no-param-reassign */
function removeUndefinedAndEmpty(obj) {
  Object.entries(obj).forEach(([key, value]) => {
    if (key === "auth") { return; }
    if (value === undefined) { delete obj[key]; }
    if (Array.isArray(value) && value.length === 0) { delete obj[key]; }
    if (typeof (value) === "object") {
      removeUndefinedAndEmpty(value);
      if (Object.keys(value).length === 0) { delete obj[key]; }
    }
  });
  return obj;
}

function parseFields(fields, prefix = "items") {
  if (!fields) { return undefined; }
  return fields.sort().map((field) => `${prefix}/${field}`).join(", ");
}

module.exports = {
  removeUndefinedAndEmpty,
  parseFields,
};

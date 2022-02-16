function parseArray(value) {
  if (!value) { return []; }
  if (Array.isArray(value)) { return value; }
  if (typeof (value) === "string") { return value.split("\n").map((line) => line.trim()).filter((line) => line); }
  throw new Error("Unsupprted array format");
}

module.exports = {
  boolean: (value) => {
    if (!value || value === "false") { return false; }
    return true;
  },
  text: (value) => {
    if (value) { return value.split("\n"); }
    return undefined;
  },
  number: (value) => {
    if (!value) { return undefined; }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`Value ${value} is not a valid number`);
    }
    return parsed;
  },
  autocomplete: (value, getVal) => {
    if (!value) { return undefined; }
    if (typeof (value) === "object") { return (getVal ? value.value : value.id) || value; }
    return value;
  },
  autocompleteOrArray: (value) => {
    if (!value) { return []; }
    if (Array.isArray(value)) { return value; }
    if (typeof (value) === "object") { return [value.id || value]; }
    return [value];
  },
  object: (value) => {
    if (!value) { return undefined; }
    if (typeof (value) === "object") { return value; }
    if (typeof (value) === "string") {
      try {
        return JSON.parse(value);
        /* eslint-disable no-empty */
      } catch (e) {}
      const obj = {};
      value.split("\n").forEach((row) => {
        /* eslint-disable prefer-const */
        let [key, ...val] = row.trim().split("=");
        if (!key || !val) { throw new Error("Bad object format! Expect key=value"); }
        if (Array.isArray(val)) { val = val.join("="); }
        obj[key] = val;
      });
      return obj;
    }
    throw new Error(`Value ${value} is not an object`);
  },
  string: (value) => {
    if (!value) { return undefined; }
    if (typeof (value) === "string") { return value.trim(); }
    throw new Error(`Value ${value} is not a valid string`);
  },
  googleCloudName: (value) => {
    if (!value) { return undefined; }
    if (typeof (value) === "string") {
      // Google provided regexp: '(?:[a-z](?:[-a-z0-9]{0,61}[a-z0-9])?)'
      const regex = /^[a-z]{1}[-a-z0-9]{0,61}[a-z0-9]{1}$/;
      if (!regex.test(value)) {
        throw new Error(`Name must start with a lowercase letter followed by up to 62 lowercase letters, numbers, or hyphens, and cannot end with a hyphen. ${value} is invalid.`);
      }
      return value.trim();
    }
    throw new Error(`Value ${value} is not a valid string`);
  },
  array: parseArray,
};

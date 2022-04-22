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

async function addStartupScript({ instancesClient, vmRequest, scriptText }) {
  const startUpScriptMetadata = {
    key: "startup-script",
    value: scriptText,
  };
  const [vmResult] = await instancesClient.get(vmRequest);
  const { fingerprint } = vmResult.metadata;
  return instancesClient.setMetadata({
    ...vmRequest,
    metadataResource: {
      fingerprint,
      items: [startUpScriptMetadata],
    },
  });
}

function extractUsernameFromSshPublicKey(sshKey) {
  const username = sshKey.split(" ")[2];
  if (!username) {
    throw new Error("Invalid format of SSH Public Key. Expected format:\"ssh-[algorithm] [key] [username]\"");
  }
  return username.split("@")[0];
}

module.exports = {
  removeUndefinedAndEmpty,
  parseFields,
  addStartupScript,
  extractUsernameFromSshPublicKey,
};

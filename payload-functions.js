const { extractUsernameFromSshPublicKey } = require("./helpers");

function prepareAddProjectMetadata(params) {
  if (!params.sshKey) {
    return {
      key: params.metadataKey,
      value: params.metadataValue,
      overwrite: params.overwrite,
    };
  }
  const username = extractUsernameFromSshPublicKey(params.sshKey);
  // regex from: https://unix.stackexchange.com/questions/157426/what-is-the-regex-to-validate-linux-users
  if (!username.match(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/)) {
    throw new Error(`"${username}" is not a valid Linux username.`);
  }
  const value = `${username}:${params.sshKey}`;
  return {
    key: "ssh-keys",
    value,
    overwrite: params.overwrite,
  };
}

module.exports = {
  prepareAddProjectMetadata,
};

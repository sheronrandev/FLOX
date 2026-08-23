export const logger = {
  info(event, fields = {}) { console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", event, ...fields })); },
  error(event, fields = {}) { console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event, ...fields })); },
};

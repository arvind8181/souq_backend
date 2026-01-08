import moment from "moment-timezone";
export const convertTimeToUTC = (timeStr) => {
  if (!timeStr) return null; // ✅ correct variable
  const d = new Date(timeStr); // ✅ parse it

  if (isNaN(d)) {
    throw new Error("Invalid ISO date-time received");
  }

  return d; // Mongoose will treat this as a UTC instant
};
export const getUTCRangeForLocalDate = (date, timezone = "UTC") => {
  const startUTC = moment
    .tz(date, "YYYY-MM-DD", timezone)
    .startOf("day")
    .utc()
    .toDate();
  const endUTC = moment
    .tz(date, "YYYY-MM-DD", timezone)
    .endOf("day")
    .utc()
    .toDate();
  return { startUTC, endUTC };
};

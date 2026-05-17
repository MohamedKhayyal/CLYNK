const AppError = require("./app.Error");

const toNumber = (value) => {
  if (value === "" || value === undefined || value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

exports.normalizeGeoLocation = (geoLocation, fieldName = "geo_location") => {
  if (geoLocation === undefined) return undefined;
  if (geoLocation === null || geoLocation === "") return null;

  let latitude;
  let longitude;

  if (Array.isArray(geoLocation)) {
    [latitude, longitude] = geoLocation;
  } else if (typeof geoLocation === "string") {
    const trimmedGeoLocation = geoLocation.trim();
    if (trimmedGeoLocation === "") return null;

    if (
      (trimmedGeoLocation.startsWith("{") && trimmedGeoLocation.endsWith("}")) ||
      (trimmedGeoLocation.startsWith("[") && trimmedGeoLocation.endsWith("]"))
    ) {
      try {
        return exports.normalizeGeoLocation(
          JSON.parse(trimmedGeoLocation),
          fieldName,
        );
      } catch (err) {
        throw new AppError(`${fieldName} must be valid JSON or latitude,longitude`, 400);
      }
    }

    [latitude, longitude] = trimmedGeoLocation.split(",").map((part) => part.trim());
  } else if (typeof geoLocation === "object") {
    latitude = geoLocation.latitude ?? geoLocation.lat;
    longitude = geoLocation.longitude ?? geoLocation.lng ?? geoLocation.lon;
  } else {
    throw new AppError(`${fieldName} must include latitude and longitude`, 400);
  }

  latitude = toNumber(latitude);
  longitude = toNumber(longitude);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude === null ||
    longitude === null
  ) {
    throw new AppError(`${fieldName} must include valid latitude and longitude`, 400);
  }

  if (latitude < -90 || latitude > 90) {
    throw new AppError(`${fieldName}.latitude must be between -90 and 90`, 400);
  }

  if (longitude < -180 || longitude > 180) {
    throw new AppError(`${fieldName}.longitude must be between -180 and 180`, 400);
  }

  return { latitude, longitude };
};

const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

exports.getGeoLocationFromBody = (body, targetKey = "geo_location") => {
  if (!body) return undefined;

  if (hasOwn(body, targetKey)) {
    return body[targetKey];
  }

  const candidatePairs = [
    [`${targetKey}[latitude]`, `${targetKey}[longitude]`],
    [`${targetKey}[lat]`, `${targetKey}[lng]`],
    [`${targetKey}[lat]`, `${targetKey}[lon]`],
    [`${targetKey}.latitude`, `${targetKey}.longitude`],
    [`${targetKey}.lat`, `${targetKey}.lng`],
    [`${targetKey}.lat`, `${targetKey}.lon`],
    [`${targetKey}_latitude`, `${targetKey}_longitude`],
    [`${targetKey}_lat`, `${targetKey}_lng`],
    [`${targetKey}_lat`, `${targetKey}_lon`],
    ["latitude", "longitude"],
    ["lat", "lng"],
    ["lat", "lon"],
  ];

  for (const [latKey, lonKey] of candidatePairs) {
    if (hasOwn(body, latKey) || hasOwn(body, lonKey)) {
      return {
        latitude: body[latKey],
        longitude: body[lonKey],
      };
    }
  }

  return undefined;
};

exports.attachGeoLocation = (
  record,
  {
    targetKey = "geo_location",
    latKey = `${targetKey}_latitude`,
    lonKey = `${targetKey}_longitude`,
  } = {},
) => {
  if (!record) return record;

  const latitude = record[latKey];
  const longitude = record[lonKey];

  record[targetKey] =
    latitude === null || latitude === undefined || longitude === null || longitude === undefined
      ? null
      : {
          latitude: Number(latitude),
          longitude: Number(longitude),
        };

  delete record[latKey];
  delete record[lonKey];

  return record;
};

exports.attachGeoLocationToMany = (records, options) =>
  records.map((record) => exports.attachGeoLocation(record, options));

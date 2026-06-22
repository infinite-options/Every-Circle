/** Map nearby API rows to marker payloads; skips users without valid coordinates. */
export function nearbyPeopleToMapMarkers(people = []) {
  return people
    .map((person) => {
      const lat = parseFloat(person.profile_personal_nearby_lat);
      const lng = parseFloat(person.profile_personal_nearby_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const firstName = person.profile_personal_first_name || "";
      const lastName = person.profile_personal_last_name || "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        uid: person.profile_personal_uid,
        lat,
        lng,
        name: fullName || "Nearby user",
        image: person.profile_personal_image || null,
        distanceMeters: person.distance_meters,
      };
    })
    .filter(Boolean);
}

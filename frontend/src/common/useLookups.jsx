import { useEffect, useMemo, useState } from "react";
import { fetchAPI } from "../api.mjs";

/**
 * Loads the public trainer and location lists used to populate form controls
 * (e.g. timetable filters) and to resolve IDs to names.
 */
export function useLookups() {
  const [trainers, setTrainers] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetchAPI("GET", "/trainers")
      .then((response) => response.status === 200 && setTrainers(response.body))
      .catch(() => {});
    fetchAPI("GET", "/locations")
      .then(
        (response) => response.status === 200 && setLocations(response.body),
      )
      .catch(() => {});
  }, []);

  const trainerById = useMemo(
    () => new Map(trainers.map((trainer) => [trainer.id, trainer])),
    [trainers],
  );
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  return { trainers, locations, trainerById, locationById };
}

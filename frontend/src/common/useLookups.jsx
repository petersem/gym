import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import { can } from "./permissions.mjs";
import { useRetryWhile } from "./useRetryWhile.jsx";

/**
 * Loads authenticated trainer and location lists used to populate form controls
 * (e.g. timetable filters) and to resolve IDs to names.
 */
export function useLookups() {
  const { user, authFetch } = useAuthenticate();
  const canRead = can(user, "listTrainers") && can(user, "readLocations");
  const [trainers, setTrainers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const load = useCallback(() => {
    Promise.all([authFetch("GET", "/trainers"), authFetch("GET", "/locations")])
      .then(([trainerResponse, locationResponse]) => {
        for (const response of [trainerResponse, locationResponse]) {
          if (response.status !== 200) {
            throw new Error(response.body.message);
          }
        }
        if (mounted.current) {
          setTrainers(trainerResponse.body);
          setLocations(locationResponse.body);
          setError(null);
        }
      })
      .catch((error) => {
        if (mounted.current) {
          setError(error instanceof Error ? error.message : String(error));
        }
      });
  }, [authFetch]);

  useEffect(() => {
    mounted.current = true;
    if (canRead) {
      load();
    }
    return () => {
      mounted.current = false;
    };
  }, [canRead, load]);

  useRetryWhile(canRead && error !== null, load);

  const trainerById = useMemo(
    () =>
      new Map(canRead ? trainers.map((trainer) => [trainer.id, trainer]) : []),
    [canRead, trainers],
  );
  const locationById = useMemo(
    () =>
      new Map(
        canRead ? locations.map((location) => [location.id, location]) : [],
      ),
    [canRead, locations],
  );

  return {
    trainers: canRead ? trainers : [],
    locations: canRead ? locations : [],
    trainerById,
    locationById,
    error: canRead ? error : null,
  };
}

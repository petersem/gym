import { useEffect, useRef, useState } from "react";
import { fullName, initials } from "./format.mjs";
import { roleOf, ROLE_BADGE } from "./permissions.mjs";

function UserBadge({ user }) {
  const role = roleOf(user);
  const name = fullName(user);
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [fits, setFits] = useState(true);

  // Show the full name only when it fits the space left in the navbar.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !name) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (measureRef.current) {
        setFits(measureRef.current.offsetWidth <= container.clientWidth);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [name]);

  if (!user) {
    return (
      <span
        className={`badge badge-sm rounded leading-none ${ROLE_BADGE[role]}`}
      >
        {role}
      </span>
    );
  }

  const badgeClass = `badge badge-sm rounded whitespace-nowrap leading-none ${ROLE_BADGE[role]}`;
  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 justify-end"
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className={`${badgeClass} invisible absolute right-0`}
      >
        {name}
      </span>
      <div className="tooltip tooltip-bottom flex items-center" data-tip={role}>
        <span className={badgeClass} aria-label={`${name} (${role})`}>
          {fits ? name : initials(user)}
        </span>
      </div>
    </div>
  );
}

export default UserBadge;

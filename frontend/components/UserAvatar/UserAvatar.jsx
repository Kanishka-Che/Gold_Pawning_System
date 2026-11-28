import { useState } from "react";
import { UserRound } from "lucide-react";

import { API_URL } from "../../utils/api.js";

import "./UserAvatar.scss";

export default function UserAvatar({
  user,
  size = 40,
  previewUrl = null,
  className = "",
}) {
  const [failedSource, setFailedSource] =
    useState(null);

  const fileName = user?.profileImage;

  const validFileName =
    typeof fileName === "string" &&
    /^profile-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(
      fileName
    );

  const imageSource =
    previewUrl ||
    (
      validFileName
        ? `${API_URL}/api/auth/profile-images/${encodeURIComponent(
            fileName
          )}`
        : null
    );

  const showImage =
    imageSource &&
    failedSource !== imageSource;

  return (
    <span
      className={`shared-user-avatar ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          key={imageSource}
          src={imageSource}
          alt=""
          draggable={false}
          onError={() =>
            setFailedSource(imageSource)
          }
        />
      ) : (
        <UserRound
          size={Math.round(size * 0.52)}
        />
      )}
    </span>
  );
}
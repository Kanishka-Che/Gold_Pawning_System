import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  Trash2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

import UserAvatar from
  "../UserAvatar/UserAvatar.jsx";

import {
  updateMyProfileImage,
  removeMyProfileImage,
} from "../../utils/authApi.js";

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export default function ProfileImageEditor({
  user,
  onUpdated,
  onSessionEnded,
}) {
  const [selectedFile, setSelectedFile] =
    useState(null);

  const [previewUrl, setPreviewUrl] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const inputRef = useRef(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url =
      URL.createObjectURL(selectedFile);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || savingRef.current) {
      return;
    }

    setError("");
    setSuccess("");

    if (!allowedTypes.has(file.type)) {
      setSelectedFile(null);

      setError(
        "Only JPG, PNG and WebP images are allowed."
      );

      return;
    }

    if (
      file.size === 0 ||
      file.size > MAX_IMAGE_SIZE
    ) {
      setSelectedFile(null);

      setError(
        "Image must not exceed 5 MB."
      );

      return;
    }

    setSelectedFile(file);
  };

  const cancelPreview = () => {
    setSelectedFile(null);
    setError("");
    setSuccess("");
  };

  const saveImage = async () => {
    if (
      !selectedFile ||
      savingRef.current
    ) {
      return;
    }

    savingRef.current = true;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result =
        await updateMyProfileImage(
          selectedFile
        );

      onUpdated(result.user);

      if (mountedRef.current) {
        setSelectedFile(null);
        setSuccess(result.message);
      }

    } catch (err) {
      if (err.status === 401) {
        if (mountedRef.current) {
          onSessionEnded();
        }

        return;
      }

      if (mountedRef.current) {
        setError(err.message);
      }

    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  const removeImage = async () => {
    if (
      savingRef.current ||
      !user?.profileImage
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove your profile photo?"
    );

    if (!confirmed) return;

    savingRef.current = true;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result =
        await removeMyProfileImage();

      onUpdated(result.user);

      if (mountedRef.current) {
        setSelectedFile(null);
        setSuccess(result.message);
      }

    } catch (err) {
      if (err.status === 401) {
        if (mountedRef.current) {
          onSessionEnded();
        }

        return;
      }

      if (mountedRef.current) {
        setError(err.message);
      }

    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  return (
    <div className="ap-image-editor">
      <div className="ap-image-preview">
        <UserAvatar
          user={user}
          size={112}
          previewUrl={previewUrl}
        />

        {selectedFile && (
          <small>Image Preview</small>
        )}
      </div>

      <div className="ap-image-content">
        <h3>Profile Photo</h3>

        <p>
          JPG, PNG or WebP.
          Maximum file size 5 MB.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          disabled={saving}
          onChange={handleFileChange}
        />

        {error && (
          <div
            className="ap-error"
            role="alert"
          >
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        {success && (
          <div
            className="ap-image-success"
            role="status"
          >
            <Check size={17} />
            {success}
          </div>
        )}

        <div className="ap-image-actions">
          {selectedFile ? (
            <>
              <button
                type="button"
                className="ap-primary-btn"
                disabled={saving}
                onClick={saveImage}
              >
                <Check size={17} />

                {saving
                  ? "Saving..."
                  : "Save Photo"}
              </button>

              <button
                type="button"
                className="ap-secondary-btn"
                disabled={saving}
                onClick={cancelPreview}
              >
                <X size={17} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ap-primary-btn"
                disabled={saving}
                onClick={() =>
                  inputRef.current?.click()
                }
              >
                <Camera size={17} />

                {user?.profileImage
                  ? "Change Photo"
                  : "Upload Photo"}
              </button>

              {user?.profileImage && (
                <button
                  type="button"
                  className="ap-remove-photo-btn"
                  disabled={saving}
                  onClick={removeImage}
                >
                  <Trash2 size={17} />

                  {saving
                    ? "Removing..."
                    : "Remove Photo"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
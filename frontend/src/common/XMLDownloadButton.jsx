import { useCallback, useState } from "react";
import { FaFileDownload } from "react-icons/fa";
import { API_BASE_URL } from "../api.mjs";

function XMLDownloadButton({
  className,
  children,
  route,
  authenticationKey = "",
  filename = "export.xml",
  onError = console.error,
}) {
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(() => {
    setDownloading(true);
    fetch(API_BASE_URL + route, {
      method: "GET",
      headers: {
        "x-auth-key": authenticationKey,
      },
    })
      .then(async (response) => {
        if (response.status === 200) {
          const data = await response.blob();
          const a = document.createElement("a");
          a.href = URL.createObjectURL(data);
          a.setAttribute("download", filename);
          document.body.append(a);
          a.click();
          a.remove();
          // Revoking immediately can cancel the download in some browsers.
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } else {
          const body = await response.json().catch(() => ({}));
          onError(body.message ?? "Download failed");
        }
      })
      .catch((error) => {
        onError("Failed to download - " + error);
      })
      .finally(() => setDownloading(false));
  }, [route, authenticationKey, filename, onError]);

  return (
    <button onClick={download} className={className} disabled={downloading}>
      {downloading ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <FaFileDownload />
      )}
      {children}
    </button>
  );
}

export default XMLDownloadButton;

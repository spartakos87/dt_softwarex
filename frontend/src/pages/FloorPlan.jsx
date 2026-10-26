import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleX } from 'lucide-react';

const floors = [
  { id: 0, name: "Floor 0", img: "/floor_0_captions.jpg", alt: "Floor plan 0" },
  { id: 1, name: "Floor 1", img: "/floor_1_captions.jpg", alt: "Floor plan 1" },
];

const FloorPlan = () => {
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState({ open: false, src: "", alt: "" });

  const goTo3D = (floor) => navigate(`/building-3d/${floor}`);

  const openLightbox = (src, alt) => setLightbox({ open: true, src, alt });
  const closeLightbox = () => setLightbox({ open: false, src: "", alt: "" });

  // Close on ESC
  useEffect(() => {
    if (!lightbox.open) return;
    const onKey = (e) => e.key === "Escape" && closeLightbox();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox.open]);

  return (
    <div style={{ padding: "2rem" }}>
      {/* Back button */}
      <button onClick={() => navigate(-1)} style={styles.backBtn} aria-label="Go back">
        ⬅ Back
      </button>

      <h1 style={{ textAlign: "center", fontSize: 28, marginBottom: "1.5rem" }}>
        Floor Plans
      </h1>

      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        {/* Gallery */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {floors.map((f) => (
            <div
              key={f.id}
              style={{
                border: "1px solid #e5e7eb",
                padding: "1rem",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                textAlign: "center",
              }}
            >
              {/* Click to open lightbox */}
              <div
                onClick={() => openLightbox(f.img, f.alt)}
                title="Click to zoom"
                style={{
                  aspectRatio: "4 / 3",
                  background: "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <img
                  src={f.img}
                  alt={f.alt}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  loading="lazy"
                />
              </div>

              <div style={{ padding: 16 }}>
                <button
                  onClick={() => goTo3D(f.id)}
                  style={{
                    width: "auto",
                    padding: "10px 16px",
                    backgroundColor: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  Proceed to 3D Building View for floor {f.id}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox.open && (
        <div style={styles.overlay} onClick={closeLightbox} role="dialog" aria-modal="true">
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close"
              onClick={closeLightbox}
              style={styles.closeBtn}
              title="Close (Esc)"
            >
              <CircleX />
            </button>
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              style={styles.modalImg}
            />
            <div style={styles.caption}>{lightbox.alt}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    marginBottom: "1rem",
    color: "#007BFF",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    zIndex: 1000,
  },
  modal: {
    position: "relative",
    background: "#fff",
    borderRadius: 12,
    padding: "3rem",
    maxWidth: "95vw",
    maxHeight: "90vh",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: "0.2rem",             // distance from top of modal
    right: "0rem",           // distance from right of modal
    padding: "0.2rem",
    backgroundColor: "transparent",
    color: "#f00",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "1.2rem"
  },
  modalImg: {
    maxWidth: "90vw",
    maxHeight: "80vh",
    objectFit: "contain",
    borderRadius: 8,
  },
  caption: {
    marginTop: 8,
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
};

export default FloorPlan;

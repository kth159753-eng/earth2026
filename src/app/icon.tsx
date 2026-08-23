import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090d",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 99,
            background: "linear-gradient(135deg, #f0d9a8, #3d6b7a)",
          }}
        />
      </div>
    ),
    size,
  );
}

"use client";

import { useEffect } from "react";

export function TrailingSlash() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname.endsWith("/") || pathname.includes(".")) return;
    window.location.replace(`${pathname}/${search}${hash}`);
  }, []);
  return null;
}

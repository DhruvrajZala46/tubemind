if (typeof global !== "undefined" && typeof global.self === "undefined") {
  // @ts-ignore
  global.self = global;
} 
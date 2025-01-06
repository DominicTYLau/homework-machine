export default {
  overrides: [
    {
      files: "*.html",
      options: {
        printWidth: 100,
      },
    },
    {
      files: "*.svg",
      options: {
        parser: "html",
        printWidth: Infinity,
      },
    },
  ],
  trailingComma: "all",
};

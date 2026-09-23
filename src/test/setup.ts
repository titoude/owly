import "@testing-library/jest-dom/vitest";
import { beforeAll } from "vitest";
import "fake-indexeddb/auto";

beforeAll(() => {
  // jsdom lacks these but components don't need real implementations
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => {};
  }
});

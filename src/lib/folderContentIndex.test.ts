import { describe, expect, it } from "vitest";
import { createFolderContentIndex } from "./folderContentIndex";

describe("createFolderContentIndex", () => {
  const folders = [
    { id: "root", parent_id: null },
    { id: "child", parent_id: "root" },
    { id: "nested", parent_id: "child" },
    { id: "other", parent_id: null },
  ];
  const media = [
    { id: "a", folder_id: "root" },
    { id: "b", folder_id: "child" },
    { id: "c", folder_id: "nested" },
    { id: "d", folder_id: "other" },
    { id: "unfiled", folder_id: null },
  ];

  it("indexes children without repeated tree scans", () => {
    const index = createFolderContentIndex(folders, media);
    expect(index.getChildren(null).map((folder) => folder.id)).toEqual(["root", "other"]);
    expect(index.getChildren("root").map((folder) => folder.id)).toEqual(["child"]);
  });

  it("collects direct and nested media once per subtree", () => {
    const index = createFolderContentIndex(folders, media);
    expect(index.getDirectMedia("root").map((item) => item.id)).toEqual(["a"]);
    expect(index.getSubtreeMedia("root").map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(index.getSubtreeCount("child")).toBe(2);
    expect(index.getSubtreeCount("other")).toBe(1);
  });

  it("does not recurse forever when malformed data contains a cycle", () => {
    const index = createFolderContentIndex(
      [{ id: "a", parent_id: "b" }, { id: "b", parent_id: "a" }],
      [{ id: "media", folder_id: "a" }],
    );
    expect(index.getSubtreeCount("a")).toBe(1);
  });
});

// Phase 3 check: one "route" moved to Prisma ORM 8.
// Reads through the v8 fluent client only; writes nothing.
import { db, prisma } from "./prisma/db";

async function main() {
  // The migrated read: deterministic order, paginated with limit/offset.
  const posts = await db.orm.public.Post.orderBy((post) => post.id.asc())
    .limit(20)
    .offset(0)
    .all();
  console.log("V8_POSTS_COUNT " + posts.length);
  for (const p of posts) {
    console.log(
      "V8_POST id=" +
        p.id +
        " title=" +
        JSON.stringify(p.title) +
        " createdAtType=" +
        typeof p.createdAt +
        " createdAtCtor=" +
        (p.createdAt?.constructor?.name ?? "none") +
        " createdAt=" +
        String(p.createdAt),
    );
  }

  const tags = await db.orm.public.Tag.orderBy((tag) => tag.label.asc()).all();
  console.log("V8_TAGS_COUNT " + tags.length);
  for (const t of tags) {
    console.log("V8_TAG id=" + t.id + " label=" + t.label);
  }

  // Same rows through the junction model, the explicit PostTag.
  const links = await db.orm.public.PostTag.orderBy((pt) => pt.tagId.asc())
    .all();
  console.log("V8_POSTTAG_COUNT " + links.length);
  for (const l of links) {
    console.log("V8_POSTTAG postId=" + l.postId + " tagId=" + l.tagId);
  }

  // The unmigrated side still works against the same database.
  const v7Count = await prisma.post.count();
  console.log("V7_POSTS_COUNT " + v7Count);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

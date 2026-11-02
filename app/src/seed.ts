import { prisma } from "./db";

async function main() {
  const typescript = await prisma.tag.create({ data: { label: "typescript" } });
  const database = await prisma.tag.create({ data: { label: "database" } });
  const release = await prisma.tag.create({ data: { label: "release-notes" } });

  await prisma.post.create({
    data: {
      title: "Prisma 8 Is Breaking Your Schema",
      price: 0,
      metadata: { kind: "guide" },
      tags: { connect: [{ id: typescript.id }, { id: database.id }] },
    },
  });
  await prisma.post.create({
    data: {
      title: "Shipping the RC by Accident",
      price: 0,
      metadata: { kind: "postmortem" },
      tags: { connect: [{ id: database.id }, { id: release.id }] },
    },
  });
  await prisma.post.create({
    data: {
      title: "Untagged Notes",
      price: 0,
      metadata: { kind: "note" },
    },
  });

  const postCount = await prisma.post.count();
  const tagCount = await prisma.tag.count();
  const tags = await prisma.tag.findMany({ orderBy: { label: "asc" } });
  console.log("SEED_OK posts=" + postCount + " tags=" + tagCount);
  for (const t of tags) {
    console.log("TAG " + t.label + " id=" + t.id + " idType=" + typeof t.id);
  }
  const sample = await prisma.post.findFirst({ include: { tags: true } });
  console.log(
    "SAMPLE createdAt ctor=" +
      (sample?.createdAt?.constructor?.name ?? "none") +
      " isDate=" +
      (sample?.createdAt instanceof Date),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

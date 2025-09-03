/*
  Warnings:

  - You are about to drop the column `date` on the `Reservation` table. All the data in the column will be lost.
  - Added the required column `phone` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `datetime` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL
);
INSERT INTO "new_Member" ("email", "id", "name") SELECT "email", "id", "name" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE TABLE "new_Reservation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datetime" DATETIME NOT NULL,
    "tableId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("id", "memberId", "tableId") SELECT "id", "memberId", "tableId" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

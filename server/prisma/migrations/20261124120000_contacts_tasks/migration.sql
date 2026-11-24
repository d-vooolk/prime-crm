BEGIN;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Task_assigneeId_isDone_idx" ON "Task"("assigneeId", "isDone");

-- CreateIndex
CREATE INDEX "Task_authorId_isDone_idx" ON "Task"("authorId", "isDone");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Serviceman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Контакты из заметок администратора (роль «Менеджер» или значок «Администратор», кроме
-- руководителей). Заметки остаются на месте и по-прежнему видны только Создателю.
-- Первая строка заметки — название контакта, остальное — комментарий; длинная первая строка
-- обрезается в названии, а весь текст уходит в комментарий, чтобы ничего не потерять
INSERT INTO "Contact" ("id", "name", "phone", "comment", "createdAt", "updatedAt")
SELECT
    'note_' || n."id",
    CASE WHEN length(n.first_line) > 200 THEN left(n.first_line, 197) || '...' ELSE n.first_line END,
    NULL,
    CASE
        WHEN length(n.first_line) > 200 THEN n.body
        ELSE NULLIF(btrim(substr(n.body, length(split_part(n.body, E'\n', 1)) + 2)), '')
    END,
    n."createdAt",
    CURRENT_TIMESTAMP
FROM (
    SELECT
        note."id",
        note."createdAt",
        btrim(replace(note."text", E'\r', '')) AS body,
        btrim(split_part(btrim(replace(note."text", E'\r', '')), E'\n', 1)) AS first_line
    FROM "Note" note
    JOIN "Serviceman" s ON s."id" = note."servicemanId"
    WHERE s."role" = 'Менеджер'
       OR (s."badge" = 'ADMIN' AND COALESCE(s."role", '') NOT IN ('Создатель', 'Директор'))
) n
WHERE n.body <> '';

COMMIT;

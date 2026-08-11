'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ICON_MAP } from '@/lib/category-icons';
import { DOT_COLOR_CLASS, CARD_TINT_COLOR_CLASS } from '@/lib/category-colors';
import { reorderIds } from '@/lib/categories-reorder';
import type { Category } from '@/lib/categories-types';
import { EmptyState } from '@/components/shared/EmptyState';

interface CategoryListProps {
  categories: Category[];
  onReorder: (orderedIds: string[]) => void;
  onEdit: (category: Category) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (category: Category) => void;
}

export function CategoryList({ categories, onReorder, onEdit, onArchive, onUnarchive, onDelete }: CategoryListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId) return;
    const activeId = String(event.active.id);
    const ids = categories.map((c) => c.id);
    const next = reorderIds(ids, activeId, String(overId));
    if (next.join() !== ids.join()) onReorder(next);
  }

  if (categories.length === 0) {
    return <EmptyState message="No categories yet." />;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function CategoryRow({
  category,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (category: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id, disabled: category.archived });
  const Icon = ICON_MAP[category.icon];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="category-row"
      className={`flex items-center gap-3 rounded-2xl p-4 ${category.archived ? 'bg-neutral-100' : CARD_TINT_COLOR_CLASS[category.colorSlot]}`}
    >
      {!category.archived && (
        <button
          type="button"
          data-testid="category-drag-handle"
          aria-label={`Reorder ${category.name}`}
          className="cursor-grab touch-none text-neutral-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${DOT_COLOR_CLASS[category.colorSlot]}`}>
        <Icon className="h-5 w-5 text-white" />
      </span>
      <span className="flex-1 text-sm font-medium text-neutral-900">{category.name}</span>
      {category.archived && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Archived</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label={`Actions for ${category.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onEdit(category)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {category.archived ? (
            <DropdownMenuItem onClick={() => onUnarchive(category.id)}>
              <ArchiveRestore className="h-4 w-4" />
              Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onArchive(category.id)}>
              <Archive className="h-4 w-4" />
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(category)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

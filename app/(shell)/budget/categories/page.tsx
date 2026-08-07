'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Merge, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryList } from '@/components/categories/CategoryList';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { DeleteCategoryDialog } from '@/components/categories/DeleteCategoryDialog';
import { MergeCategoriesDialog } from '@/components/categories/MergeCategoriesDialog';
import { useCategories } from '@/lib/use-categories';
import { countBillsUsingCategory } from '@/lib/categories-repository';
import type { Category } from '@/lib/categories-types';

export default function CategoriesPage() {
  const { categories, activeCategories, archivedCategories, loading, error, create, update, archive, unarchive, remove, merge, reorder } =
    useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteBillCount, setDeleteBillCount] = useState(0);
  const [mergeOpen, setMergeOpen] = useState(false);

  function openAddForm() {
    setEditingCategory(undefined);
    setFormOpen(true);
  }

  function openEditForm(category: Category) {
    setEditingCategory(category);
    setFormOpen(true);
  }

  async function handleSubmit(input: { name: string; icon: Category['icon']; colorSlot: number }) {
    if (editingCategory) {
      await update(editingCategory.id, input);
    } else {
      await create(input);
    }
  }

  async function openDeleteDialog(category: Category) {
    const count = await countBillsUsingCategory(category.id);
    setDeleteBillCount(count);
    setDeleteTarget(category);
  }

  return (
    <div data-testid="categories-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/budget" aria-label="Back to Budget">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-medium text-neutral-900">Manage Categories</h1>
      </div>

      {error && <p className="text-sm text-status-critical">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
        <Button variant="outline" onClick={() => setMergeOpen(true)}>
          <Merge className="h-4 w-4" />
          Merge Categories
        </Button>
      </div>

      {!loading && (
        <CategoryList
          categories={activeCategories}
          onReorder={reorder}
          onEdit={openEditForm}
          onArchive={archive}
          onUnarchive={unarchive}
          onDelete={openDeleteDialog}
        />
      )}

      {archivedCategories.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-neutral-500">Archived</h2>
          <CategoryList
            categories={archivedCategories}
            onReorder={reorder}
            onEdit={openEditForm}
            onArchive={archive}
            onUnarchive={unarchive}
            onDelete={openDeleteDialog}
          />
        </div>
      )}

      <CategoryForm
        key={`${editingCategory?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        initialCategory={editingCategory}
        onSubmit={handleSubmit}
      />

      {deleteTarget && (
        <DeleteCategoryDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          category={deleteTarget}
          billCount={deleteBillCount}
          otherCategories={categories.filter((c) => c.id !== deleteTarget.id)}
          onConfirm={(reassignToId) => remove(deleteTarget.id, reassignToId)}
        />
      )}

      <MergeCategoriesDialog open={mergeOpen} onOpenChange={setMergeOpen} categories={categories} onConfirm={merge} />
    </div>
  );
}

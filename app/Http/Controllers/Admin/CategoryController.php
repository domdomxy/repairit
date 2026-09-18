<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Categories/Index', [
            'categories' => Category::query()
                ->withCount('technicianProfiles as technician_count')
                ->orderBy('name')
                ->get(['id', 'name', 'slug']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        [$name, $slug] = $this->validated($request);

        $category = Category::create(['name' => $name, 'slug' => $slug]);

        AdminLog::record($request->user(), 'category.created', "Created category \"{$name}\"", $category);

        return back()->with('success', "Category \"{$name}\" created.");
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        [$name, $slug] = $this->validated($request, $category);

        $oldName = $category->name;
        $category->update(['name' => $name, 'slug' => $slug]);

        AdminLog::record(
            $request->user(),
            'category.updated',
            "Renamed category \"{$oldName}\" to \"{$name}\"",
            $category,
        );

        return back()->with('success', 'Category updated.');
    }

    public function destroy(Request $request, Category $category): RedirectResponse
    {
        $technicians = $category->technicianProfiles()->count();

        AdminLog::record(
            $request->user(),
            'category.deleted',
            "Deleted category \"{$category->name}\" (was assigned to {$technicians} technician(s))",
            $category,
        );

        // The pivot rows cascade, so technicians simply lose this specialty.
        $category->delete();

        return back()->with('success', 'Category deleted.');
    }

    /**
     * Validate the name and derive its slug. The slug is what search URLs use,
     * so two names that slugify the same ("Plumbing" / "plumbing!") clash even
     * though the names differ.
     *
     * @return array{0: string, 1: string} [name, slug]
     */
    private function validated(Request $request, ?Category $category = null): array
    {
        $name = trim((string) $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ])['name']);

        $slug = Str::slug($name);

        if ($slug === '') {
            throw ValidationException::withMessages([
                'name' => 'The name must contain letters or numbers.',
            ]);
        }

        $taken = Category::where('slug', $slug)
            ->when($category, fn ($query) => $query->whereKeyNot($category->getKey()))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages([
                'name' => 'A category with this name already exists.',
            ]);
        }

        return [$name, $slug];
    }
}

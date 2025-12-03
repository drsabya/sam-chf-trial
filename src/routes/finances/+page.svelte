<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { fade, fly } from 'svelte/transition';
    import { 
        Wallet, 
        TrendingUp, 
        TrendingDown, 
        Plus, 
        X, 
        FileText, 
        CheckCircle2, 
        Clock, 
        Briefcase, 
        PenTool,
        MoreHorizontal
    } from '@lucide/svelte';

    let { data, form }: { data: PageData; form: ActionData | null } = $props();

    const { expenses, funds, availableTravelFunds, availableStationaryFunds } = data;

    const fundError = (form as any)?.fundError ?? null;
    const expenseError = (form as any)?.expenseError ?? null;
    const fundSuccess = (form as any)?.fundSuccess ?? false;
    const expenseSuccess = (form as any)?.expenseSuccess ?? false;

    let showFundDialog = $state(false);
    let showExpenseDialog = $state(false);

    let expenseCategory = $state<'travel' | 'stationary'>('travel');
    let expensePaidBy = $state<'funds' | 'out of pocket'>('funds');

    function formatCurrency(value: number) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(value || 0);
    }

    function formatDate(value: string) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    // Helper to map DB values to display labels
    function getCategoryLabel(category: string | null | undefined) {
        const c = (category || '').toLowerCase();
        if (c === 'travel') return 'Travel Voucher';
        if (c === 'stationary') return 'Stationery';
        return category || '';
    }
</script>

<div class="min-h-screen bg-slate-50/50 text-slate-800 font-sans selection:bg-slate-200">
    <div class="max-w-6xl mx-auto px-6 py-12 space-y-10">
        
        <header class="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div class="space-y-2">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm mb-2">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Finance Dashboard</span>
                </div>
                <h1 class="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
                <p class="text-slate-500 max-w-lg">
                    Manage your clinical trial allocations. Track travel and stationery budgets against real-world expenses.
                </p>
            </div>

            <div class="flex items-center gap-3">
                <button
                    type="button"
                    onclick={() => (showFundDialog = true)}
                    class="group inline-flex items-center gap-2 rounded-xl bg-white text-slate-700 text-sm font-medium px-5 py-2.5 border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95"
                >
                    <Plus class="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    Add Funds
                </button>
                <button
                    type="button"
                    onclick={() => (showExpenseDialog = true)}
                    class="group inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm font-medium px-5 py-2.5 shadow-md shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                >
                    <Plus class="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    Log Expense
                </button>
            </div>
        </header>

        {#if fundSuccess || expenseSuccess}
            <div
                transition:fade={{ duration: 200 }}
                class="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800"
            >
                <CheckCircle2 class="w-4 h-4 text-emerald-600" />
                <span>{#if fundSuccess}Funds successfully recorded.{/if}{#if expenseSuccess}Expense successfully logged.{/if}</span>
            </div>
        {/if}

        <section class="grid gap-6 md:grid-cols-2">
            <div class="relative overflow-hidden rounded-2xl bg-white p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 group transition-all hover:shadow-md">
                <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Briefcase class="w-24 h-24" />
                </div>
                <div class="relative z-10 flex flex-col h-full justify-between gap-4">
                    <div class="flex items-center gap-3 text-slate-500">
                        <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                            <Briefcase class="w-4 h-4" />
                        </div>
                        <span class="text-xs font-semibold uppercase tracking-wider">Travel allowance</span>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-slate-900 tracking-tight">
                            {formatCurrency(availableTravelFunds)}
                        </div>
                        <div class="flex items-center gap-2 mt-2 text-xs font-medium text-emerald-600">
                            <TrendingUp class="w-3 h-3" />
                            <span>Available balance</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="relative overflow-hidden rounded-2xl bg-white p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 group transition-all hover:shadow-md">
                <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <PenTool class="w-24 h-24" />
                </div>
                <div class="relative z-10 flex flex-col h-full justify-between gap-4">
                    <div class="flex items-center gap-3 text-slate-500">
                        <div class="p-2 rounded-lg bg-amber-50 text-amber-600">
                            <PenTool class="w-4 h-4" />
                        </div>
                        <span class="text-xs font-semibold uppercase tracking-wider">Stationery Budget</span>
                    </div>
                    <div>
                        <div class="text-3xl font-bold text-slate-900 tracking-tight">
                            {formatCurrency(availableStationaryFunds)}
                        </div>
                        <div class="flex items-center gap-2 mt-2 text-xs font-medium text-emerald-600">
                            <TrendingUp class="w-3 h-3" />
                            <span>Available balance</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="grid gap-8 lg:grid-cols-2">
            
            <div class="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                        <TrendingUp class="w-4 h-4 text-emerald-600" />
                        Inflow (Funds)
                    </h3>
                    <span class="text-[10px] font-medium bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500 shadow-sm">
                        {funds.length} Records
                    </span>
                </div>

                {#if fundError}
                    <div class="m-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600">
                        {fundError}
                    </div>
                {/if}

                <div class="flex-1 overflow-auto max-h-[500px] p-2 space-y-1">
                    {#if funds.length === 0}
                        <div class="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Wallet class="w-8 h-8 mb-2 opacity-20" />
                            <p class="text-xs">No funds allocated yet.</p>
                        </div>
                    {:else}
                        {#each funds as fund}
                            <div class="group flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                <div class="flex items-start gap-3">
                                    <div class="space-y-0.5">
                                        <p class="text-sm font-medium text-slate-900">{getCategoryLabel(fund.category)}</p>
                                        <p class="text-xs text-slate-500">{formatDate(fund.date_received)}</p>
                                        {#if fund.description}
                                            <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{fund.description}</p>
                                        {/if}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm font-semibold text-emerald-600">+{formatCurrency(fund.amount)}</p>
                                    {#if fund.file_src}
                                        <a href={fund.file_src} target="_blank" class="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline flex items-center justify-end gap-1 mt-1">
                                            <FileText class="w-3 h-3" />
                                            Doc
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <div class="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                        <TrendingDown class="w-4 h-4 text-rose-600" />
                        Outflow (Expenses)
                    </h3>
                    <span class="text-[10px] font-medium bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500 shadow-sm">
                        {expenses.length} Records
                    </span>
                </div>

                {#if expenseError}
                    <div class="m-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600">
                        {expenseError}
                    </div>
                {/if}

                <div class="flex-1 overflow-auto max-h-[500px] p-2 space-y-1">
                    {#if expenses.length === 0}
                        <div class="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Wallet class="w-8 h-8 mb-2 opacity-20" />
                            <p class="text-xs">No expenses recorded yet.</p>
                        </div>
                    {:else}
                        {#each expenses as expense}
                            <div class="group flex items-start justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                <div class="flex items-start gap-3">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-2">
                                            <p class="text-sm font-medium text-slate-900">{getCategoryLabel(expense.category)}</p>
                                            {#if !expense.settled && expense.paid_by !== 'funds'}
                                                <span class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                                    <Clock class="w-2.5 h-2.5" /> Pending
                                                </span>
                                            {/if}
                                        </div>
                                        <p class="text-xs text-slate-600 line-clamp-1">{expense.purpose}</p>
                                        
                                        {#if expense.username}
                                        <p class="text-[11px] text-slate-400">
                                            {expense.username
                                                ? expense.username.charAt(0).toUpperCase() + expense.username.slice(1).toLowerCase()
                                                : ''}
                                        </p>
                                        {/if}
                                        
                                        <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                            <span>{formatDate(expense.date)}</span>
                                            {#if expense.screening_id}
                                                <span class="font-mono text-slate-500 bg-slate-100 px-1 rounded">{expense.screening_id}</span>
                                            {/if}
                                            {#if expense.visit_number}
                                                <span>Visit {expense.visit_number}</span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm font-semibold text-slate-900">
                                        {formatCurrency(expense.amount)}
                                    </p>
                                    {#if expense.bill_src}
                                        <a href={expense.bill_src} target="_blank" class="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline inline-flex items-center justify-end gap-1 mt-1">
                                            <FileText class="w-3 h-3" />
                                            Bill
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </section>

        {#if showFundDialog}
            <div transition:fade={{ duration: 150 }} class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                <div 
                    transition:fly={{ y: 20, duration: 300 }}
                    class="w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
                >
                    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 class="text-sm font-semibold text-slate-800">Add New Funds</h2>
                        <button onclick={() => (showFundDialog = false)} class="text-slate-400 hover:text-slate-600 transition-colors">
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    <form method="POST" action="?/addFund" class="p-6 space-y-4">
                        {#if fundError}
                            <p class="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{fundError}</p>
                        {/if}

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Amount</label>
                                <div class="relative">
                                    <span class="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                                    <input name="amount" type="number" step="0.01" min="0" required 
                                        class="w-full rounded-xl bg-slate-50 border border-slate-200 pl-7 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300" 
                                        placeholder="0.00" />
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date Received</label>
                                <input name="date_received" type="date" required 
                                    class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all text-slate-600" />
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Category</label>
                            <div class="relative">
                                <select name="category" required 
                                    class="w-full appearance-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all text-slate-700">
                                    <option value="travel">Travel Budget</option>
                                    <option value="stationary">Stationery Budget</option>
                                </select>
                                <div class="pointer-events-none absolute right-3 top-2.5 text-slate-400">
                                    <MoreHorizontal class="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Description</label>
                            <textarea name="description" rows="2" 
                                class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                                placeholder="Optional details..."></textarea>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Document URL</label>
                            <input name="file_src" type="url" 
                                class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                                placeholder="https://..." />
                        </div>

                        <div class="pt-2 flex justify-end gap-3">
                            <button type="button" onclick={() => (showFundDialog = false)} 
                                class="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" 
                                class="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-black transition-all active:scale-95">
                                Save Record
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        {/if}

        {#if showExpenseDialog}
            <div transition:fade={{ duration: 150 }} class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
                <div 
                    transition:fly={{ y: 20, duration: 300 }}
                    class="w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
                >
                    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 class="text-sm font-semibold text-slate-800">Log Expense</h2>
                        <button onclick={() => (showExpenseDialog = false)} class="text-slate-400 hover:text-slate-600 transition-colors">
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    <form method="POST" action="?/addExpense" class="p-6 space-y-4">
                        {#if expenseError}
                            <p class="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{expenseError}</p>
                        {/if}

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Amount</label>
                                <div class="relative">
                                    <span class="absolute left-3 top-2.5 text-slate-400 text-sm">₹</span>
                                    <input name="amount" type="number" step="0.01" min="0" required 
                                        class="w-full rounded-xl bg-slate-50 border border-slate-200 pl-7 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                                        placeholder="0.00" />
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Date</label>
                                <input name="date" type="date" required 
                                    class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all text-slate-600" />
                            </div>
                        </div>

                        

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Category</label>
                                <div class="relative">
                                    <select name="category" bind:value={expenseCategory} required 
                                        class="w-full appearance-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all text-slate-700">
                                        <option value="travel">Travel voucher</option>
                                        <option value="stationary">Stationary</option>
                                    </select>
                                    <div class="pointer-events-none absolute right-3 top-2.5 text-slate-400"><MoreHorizontal class="w-4 h-4" /></div>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Paid By</label>
                                <div class="relative">
                                    <select name="paid_by" bind:value={expensePaidBy} required 
                                        class="w-full appearance-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all text-slate-700">
                                        <option value="funds">Funds (Sponsor)</option>
                                        <option value="out of pocket">Out of Pocket</option>
                                    </select>
                                    <div class="pointer-events-none absolute right-3 top-2.5 text-slate-400"><MoreHorizontal class="w-4 h-4" /></div>
                                </div>
                            </div>
                        </div>
                        {#if expenseCategory === 'travel'}
                            <div class="grid grid-cols-2 gap-4" transition:fly={{ y: -10, duration: 200 }}>
                                <div class="space-y-1.5">
                                    <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Screening ID</label>
                                    <input name="screening_id" type="text" placeholder="e.g. S12" 
                                        class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300" />
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Visit #</label>
                                    <input name="visit_number" type="number" min="1" max="8" 
                                        class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300" />
                                </div>
                            </div>
                        {/if}

                        <div class="space-y-1.5">
                            <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Purpose</label>
                            <textarea name="purpose" rows="2" 
                                class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                                placeholder="Optional: Describe the expense..."></textarea>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bill URL</label>
                            <input name="bill_src" type="url" 
                                class="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                                placeholder="https://..." />
                        </div>

                        <div class="flex items-center justify-between pt-2">
                            {#if expensePaidBy !== 'funds'}
                                <label class="flex items-center gap-2 cursor-pointer group">
                                    <input name="settled" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20" />
                                    <span class="text-xs text-slate-600 group-hover:text-slate-900">Mark as settled</span>
                                </label>
                            {:else}
                                <span></span>
                            {/if}

                            <div class="flex gap-3">
                                <button type="button" onclick={() => (showExpenseDialog = false)} 
                                    class="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" 
                                    class="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-black transition-all active:scale-95">
                                    Save
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        {/if}
    </div>
</div>
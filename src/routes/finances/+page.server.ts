// src/routes/finances/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

type ExpenseRow = {
	id: string;
	screening_id: string | null;
	visit_number: number | null;
	category: string | null;
	amount: number;
	bill_src: string | null;
	date: string;
	purpose: string;
	settled: boolean;
	paid_by: string;
	created_at: string;
	user_id: string;
	username: string | null; // derived field
};



type FundRow = {
	id: string;
	amount: number;
	category: string;
	file_src: string | null;
	date_received: string;
	description: string;
	created_at: string;
};

// Funds still only use travel + stationary
const ALLOWED_FUND_CATEGORIES = ['travel', 'stationary'] as const;

// Expenses can use travel, stationary, misc
const ALLOWED_EXPENSE_CATEGORIES = ['travel', 'stationary', 'misc'] as const;

const ALLOWED_PAID_BY = ['funds', 'out of pocket'] as const;

export const load: PageServerLoad = async () => {
	// All expenses (include user_id)
	const {
		data: expenses,
		error: expensesError
	} = await supabase
		.from('expenses')
		.select(
			'id, screening_id, visit_number, category, amount, bill_src, date, purpose, settled, paid_by, created_at, user_id'
		)
		.order('date', { ascending: false });

	if (expensesError) {
		console.error('Error loading expenses:', expensesError);
		throw error(500, 'Failed to load expenses');
	}

	// All funds
	const {
		data: funds,
		error: fundsError
	} = await supabase
		.from('funds')
		.select('id, amount, category, file_src, date_received, description, created_at')
		.order('date_received', { ascending: false });

	if (fundsError) {
		console.error('Error loading funds:', fundsError);
		throw error(500, 'Failed to load funds');
	}

	// All user_roles (user_id -> username)
	const {
		data: roles,
		error: rolesError
	} = await supabase
		.from('user_roles')
		.select('user_id, username');

	if (rolesError) {
		console.error('Error loading user roles:', rolesError);
		throw error(500, 'Failed to load user roles');
	}

	const expenseBaseRows = (expenses ?? []) as Array<
		Omit<ExpenseRow, 'username'>
	>;
	const fundRows = (funds ?? []) as FundRow[];

	// Build map user_id -> username
	const usernameByUserId = new Map<string, string | null>();
	for (const r of roles ?? []) {
		usernameByUserId.set(r.user_id as string, (r as any).username ?? null);
	}

	// Attach username to each expense
	const expenseRows: ExpenseRow[] = expenseBaseRows.map((e) => ({
		...e,
		username: usernameByUserId.get(e.user_id) ?? null
	}));

	// Total funds per category
	const totalFundsTravel = fundRows
		.filter((f) => f.category === 'travel')
		.reduce((sum, f) => sum + Number(f.amount ?? 0), 0);

	const totalFundsStationary = fundRows
		.filter((f) => f.category === 'stationary')
		.reduce((sum, f) => sum + Number(f.amount ?? 0), 0);

	// Expenses paid from funds per category (only those with paid_by = 'funds')
	// Note: misc does NOT subtract from any fund
	const spentTravelFromFunds = expenseRows
		.filter((e) => e.paid_by === 'funds' && e.category === 'travel')
		.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

	const spentStationaryFromFunds = expenseRows
		.filter((e) => e.paid_by === 'funds' && e.category === 'stationary')
		.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

	const availableTravelFunds = totalFundsTravel - spentTravelFromFunds;
	const availableStationaryFunds = totalFundsStationary - spentStationaryFromFunds;

	return {
		expenses: expenseRows,
		funds: fundRows,
		availableTravelFunds,
		availableStationaryFunds
	};
};


export const actions: Actions = {
	addFund: async ({ request }) => {
		const formData = await request.formData();

		const amountRaw = formData.get('amount');
		const categoryRaw = (formData.get('category') ?? '').toString().trim();
		const file_src = (formData.get('file_src') ?? '').toString().trim() || null;
		const date_received = (formData.get('date_received') ?? '').toString().trim();
		const descriptionRaw = (formData.get('description') ?? '').toString().trim();

		const amount = Number(amountRaw);
		const category = categoryRaw.toLowerCase();
		const description = descriptionRaw || ''; // optional but NOT NULL in DB

		if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
			return fail(400, { fundError: 'Amount must be a positive number.' });
		}
		if (!ALLOWED_FUND_CATEGORIES.includes(category as any)) {
			return fail(400, { fundError: 'Category must be either "travel" or "stationary".' });
		}
		if (!date_received) {
			return fail(400, { fundError: 'Date received is required.' });
		}

		const { error: insertError } = await supabase.from('funds').insert({
			amount,
			category,
			file_src,
			date_received,
			description
		});

		if (insertError) {
			console.error('Error adding fund:', insertError);
			return fail(500, { fundError: 'Failed to add fund.' });
		}

		return { fundSuccess: true };
	},

		addExpense: async ({ request, locals }) => {
		const formData = await request.formData();

		const screening_id_raw = (formData.get('screening_id') ?? '').toString().trim();
		const visit_number_raw = (formData.get('visit_number') ?? '').toString().trim();
		const categoryRaw = (formData.get('category') ?? '').toString().trim();
		const amountRaw = formData.get('amount');
		const bill_src = (formData.get('bill_src') ?? '').toString().trim() || null;
		const date = (formData.get('date') ?? '').toString().trim();
		const purposeRaw = (formData.get('purpose') ?? '').toString().trim();
		const settled_raw = formData.get('settled');
		const paid_by_raw = (formData.get('paid_by') ?? '').toString().trim();

		const amount = Number(amountRaw);
		const visit_number = visit_number_raw ? Number(visit_number_raw) : null;
		const category = categoryRaw ? categoryRaw.toLowerCase() : null;
		const paid_by = paid_by_raw.toLowerCase();

		// purpose is now OPTIONAL, but DB is NOT NULL → use empty string if missing
		const purpose = purposeRaw || '';

		// settled: if paid_by = 'funds', it is ALWAYS settled
		const settledFromForm = settled_raw === 'on' || settled_raw === 'true';
		const settled = paid_by === 'funds' ? true : settledFromForm;

		const screening_id = screening_id_raw || null;

		const userId = (locals as any)?.session?.user?.id as string | undefined;
		if (!userId) {
			return fail(401, { expenseError: 'Not authenticated.' });
		}

		if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
			return fail(400, { expenseError: 'Amount must be a positive number.' });
		}
		if (!category || !ALLOWED_EXPENSE_CATEGORIES.includes(category as any)) {
			return fail(400, {
				expenseError: 'Category must be travel, stationary, or misc.'
			});
		}
		if (!date) {
			return fail(400, { expenseError: 'Date is required.' });
		}
		// 🔥 removed the "purpose is required" validation
		if (!ALLOWED_PAID_BY.includes(paid_by as any)) {
			return fail(400, {
				expenseError: 'Paid by must be "funds" or "out of pocket".'
			});
		}

		const { error: insertError } = await supabase.from('expenses').insert({
			user_id: userId,
			screening_id,
			visit_number,
			category,
			amount,
			bill_src,
			date,
			purpose, // always a string, never null
			settled,
			paid_by
		});

		if (insertError) {
			console.error('Error adding expense:', insertError);
			return fail(500, { expenseError: 'Failed to add expense.' });
		}

		return { expenseSuccess: true };
	}

};

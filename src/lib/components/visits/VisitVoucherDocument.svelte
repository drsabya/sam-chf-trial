<script lang="ts">
	import { IndianRupee, Printer } from '@lucide/svelte';

	interface Props {
		visit: any;
		participant: any;
		studyName?: string;
		amountPerVisit?: number;
		disabled?: boolean;
	}

	let {
		visit,
		participant,
		studyName = 'SAM-CHF',
		amountPerVisit = 1000,
		disabled = false
	}: Props = $props();

	function getParticipantName() {
		if (!participant) return '';

		const parts = [
			participant.first_name,
			participant.middle_name,
			participant.last_name
		].map((n) => n?.trim?.() || '');

		const full = parts.filter(Boolean).join(' ');
		return full || participant.initials || '';
	}

	function openPrintWindow() {
		const patientName = getParticipantName();
		const visitNumber = visit?.visit_number ?? '';

		// Build voucher HTML
		const voucherHtml = `
<!DOCTYPE html>
<html>
<head>
	<title>Patient Traveling Expenses Voucher</title>
	<script src="https://cdn.tailwindcss.com"><\/script>
	<style>
		body { padding: 32px; font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif; }
	</style>
</head>

<body>
	<div class="max-w-xl mx-auto space-y-6 text-slate-800 text-[14px] leading-relaxed">

		<div class="text-center">
			<p class="font-semibold tracking-tight text-slate-900 uppercase">
				SETH GS MEDICAL COLLEGE & KEM HOSPITAL
			</p>
			<p class="font-semibold tracking-tight text-slate-900 uppercase">
				DIAMOND JUBILEE SOCIETY TRUST
			</p>

			<h2 class="mt-4 text-lg font-bold underline underline-offset-4">
				Patient Traveling Expenses Voucher
			</h2>
		</div>

		<p>
			Traveling allowance for patient participating (your study name)
			<span class="font-bold underline underline-offset-4">${studyName}</span><br>
			at the rate of Rs.
			<span class="font-bold underline underline-offset-4">${amountPerVisit}</span>
			per visit.
		</p>

		<p>
			<span class="font-medium">Name:</span>
			<span class="font-bold underline underline-offset-4 ml-1">${patientName}</span>
		</p>

		<p>
			Amount paid:
			<span class="font-bold underline underline-offset-4">Rs. ${amountPerVisit}</span>
			for traveling allowance of visit number
			<span class="font-bold underline underline-offset-4">${visitNumber}</span>
		</p>

		<p>
			On date: ____________________
		</p>

		<p>
			Approved by signature: ____________________
		</p>

		<p>
			Receiver signature: ____________________
		</p>
	</div>

	<script>
		window.onload = function () {
			window.print();
			setTimeout(() => window.close(), 200);
		};
	<\/script>

</body>
</html>
`;

		// Open new window + write HTML content
		const printWindow = window.open("", "_blank", "width=800,height=900");
		
		if (printWindow) {
			printWindow.document.open();
			printWindow.document.write(voucherHtml);
			printWindow.document.close();
		}
	}
</script>

<button
	type="button"
	class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed transition"
	onclick={openPrintWindow}
	disabled={disabled}
	title="Print travel voucher"
>
	<Printer class="w-4 h-4 mr-1" />
	<span>Voucher for {getParticipantName()}</span>
</button>
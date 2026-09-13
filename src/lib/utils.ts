import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn bileşenlerinin beklediği sınıf birleştirici. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Unicode Block Elements Definitions
 * Complete set of 32 unique Unicode Block Elements (U+2580..259F)
 */

// Full set of 32 unique Unicode Block Elements (U+2580..259F)
const blocks = {
	// Basic Blocks
	full: "█",           // U+2588 FULL BLOCK
	upper_half: "▀",     // U+2580 UPPER HALF BLOCK
	lower_half: "▄",     // U+2584 LOWER HALF BLOCK
	left_half: "▌",      // U+258C LEFT HALF BLOCK
	right_half: "▐",     // U+2590 RIGHT HALF BLOCK
	
	// Vertical Fractions (Left side)
	right_one_eighth: "▏",     // U+258F LEFT ONE EIGHTH BLOCK
	right_one_quarter: "▎",    // U+258E LEFT ONE QUARTER BLOCK
	right_three_eighths: "▍",  // U+258D LEFT THREE EIGHTHS BLOCK
	right_five_eighths: "▋",   // U+258B LEFT FIVE EIGHTHS BLOCK
	right_three_quarters: "▊", // U+258A LEFT THREE QUARTERS BLOCK
	right_seven_eighths: "▉",  // U+2589 LEFT SEVEN EIGHTHS BLOCK
	
	// Horizontal Fractions (Lower side)
	lower_one_eighth: "▁",     // U+2581 LOWER ONE EIGHTH BLOCK
	lower_one_quarter: "▂",    // U+2582 LOWER ONE QUARTER BLOCK
	lower_three_eighths: "▃",  // U+2583 LOWER THREE EIGHTHS BLOCK
	lower_five_eights: "▅",    // U+2585 LOWER FIVE EIGHTHS BLOCK
	lower_three_quarter: "▆",  // U+2586 LOWER THREE QUARTERS BLOCK
	lower_seven_eights: "▇",   // U+2587 LOWER SEVEN EIGHTHS BLOCK
	
	// Upper fractions
	upper_one_eighth: "▔",     // U+2594 UPPER ONE EIGHTH BLOCK
	right_one_eighth_v2: "▕",  // U+2595 RIGHT ONE EIGHTH BLOCK
	
	// Quadrants
	quadrant_upper_left: "▘",  // U+2598 QUADRANT UPPER LEFT
	quadrant_upper_right: "▝", // U+259D QUADRANT UPPER RIGHT
	quadrant_lower_left: "▖",  // U+2596 QUADRANT LOWER LEFT
	quadrant_lower_right: "▗", // U+2597 QUADRANT LOWER RIGHT
	
	// Complex quadrants
	quadrant_ul_ll_lr: "▙",    // U+2599 QUADRANT UPPER LEFT AND LOWER LEFT AND LOWER RIGHT
	quadrant_ul_dr: "▚",       // U+259A QUADRANT UPPER LEFT AND LOWER RIGHT
	quadrant_ul_ur_ll: "▛",    // U+259B QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER LEFT
	quadrant_ul_ur_dr: "▜",    // U+259C QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER RIGHT
	quadrant_ur_ll: "▞",       // U+259E QUADRANT UPPER RIGHT AND LOWER LEFT
	quadrant_ur_ll_lr: "▟",    // U+259F QUADRANT UPPER RIGHT AND LOWER LEFT AND LOWER RIGHT
	
	// Shades
	light_shade: "░",          // U+2591 LIGHT SHADE
	medium_shade: "▒",         // U+2592 MEDIUM SHADE
	dark_shade: "▓",           // U+2593 DARK SHADE
};

module.exports = { blocks };
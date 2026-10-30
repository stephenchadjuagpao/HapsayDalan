import re


def normalize_philippine_mobile_number(value):
    """Normalize a Philippine mobile number to +639XXXXXXXXX."""
    raw = str(value or "").strip()
    compact = re.sub(r"[\s().-]", "", raw)
    if compact.startswith("00"):
        compact = "+" + compact[2:]
    if compact.startswith("09") and len(compact) == 11:
        compact = "+63" + compact[1:]
    elif compact.startswith("639") and len(compact) == 12:
        compact = "+" + compact
    if not re.fullmatch(r"\+639\d{9}", compact):
        raise ValueError("Enter a valid Philippine mobile number, such as 09XX XXX XXXX.")
    return compact

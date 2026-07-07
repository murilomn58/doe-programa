"""Domain-level errors, independent of any framework.

Raised by services; translated to HTTP status codes by the router layer.
"""


class DesignConfigError(ValueError):
    """Invalid design configuration.

    Examples: fewer than two factors for a 2^k design, a quantitative factor
    whose low/high levels are equal, a qualitative factor missing labels.
    """

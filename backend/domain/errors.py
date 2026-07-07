"""Domain-level errors, independent of any framework.

Raised by services; translated to HTTP status codes by the router layer.
"""


class DesignConfigError(ValueError):
    """Invalid design configuration.

    Examples: fewer than two factors for a 2^k design, a quantitative factor
    whose low/high levels are equal, a qualitative factor missing labels.
    """


class ResponseValueError(ValueError):
    """Invalid response-entry payload.

    Examples: a non-numeric measured value, an unknown response name, or a run
    id that does not belong to the experiment being edited.
    """


class ExperimentNotFoundError(LookupError):
    """The requested experiment does not exist."""

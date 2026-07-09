"""APIRouter for publication-quality figure export (issue 08).

Thin controller: validates the request, delegates to ``PublicationService`` to
compute the analysis + ``PlotBundle`` and render the requested figure, and
streams the bytes back as a file download. Domain errors map to HTTP status:
``ExperimentNotFoundError`` -> 404, everything else (bad format for a 3-D
surface, a plot the model does not produce, not enough data) -> 422.

The request schema lives HERE (not in ``domain.schemas``) on purpose — it is
specific to this endpoint and keeps the export lane self-contained.
"""

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from deps import PublicationServiceDep
from domain.errors import ExperimentNotFoundError, InsufficientDataError
from domain.types import RSMModel
from services.publication_service import PublicationExportError

PlotKind = str
ExportFormat = str

router = APIRouter(prefix="/export", tags=["export"])


class ExportPlotRequest(BaseModel):
    """Body for ``POST /export/plot`` — which figure, of which fit, in what format."""

    experiment_id: int
    response_name: str
    model: RSMModel = RSMModel.LINEAR
    plot: str = Field(
        description=(
            "surface | contour | pareto | main_effects | interaction | "
            "obs_vs_pred | residual_vs_fitted | qq"
        )
    )
    format: str = Field(default="png", description="png | svg | pdf | tiff")
    dpi: int = Field(default=600, ge=72, le=1200)
    factor_x: str | None = None
    factor_y: str | None = None


@router.post("/plot")
async def export_plot(
    payload: ExportPlotRequest, service: PublicationServiceDep
) -> Response:
    try:
        content, media_type, filename = await service.export_plot(
            experiment_id=payload.experiment_id,
            response_name=payload.response_name,
            model=payload.model,
            plot=payload.plot,
            fmt=payload.format,
            dpi=payload.dpi,
            factor_x=payload.factor_x,
            factor_y=payload.factor_y,
        )
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except (PublicationExportError, InsufficientDataError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

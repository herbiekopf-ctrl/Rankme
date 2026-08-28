"use client";

type RankingPositionControlProps = {
  entityName: string;
  currentRank: number | null;
  rankingLength: number;
  maxLength: number;
  disabled?: boolean;
  saving?: boolean;
  onAdd: (position: number) => void;
  onMove: (position: number) => void;
};

export function RankingPositionControl({
  entityName,
  currentRank,
  rankingLength,
  maxLength,
  disabled = false,
  saving = false,
  onAdd,
  onMove,
}: RankingPositionControlProps) {
  const isRanked = currentRank !== null;
  const positionCount = isRanked
    ? rankingLength
    : Math.min(maxLength, rankingLength + 1);
  const canAdd = !disabled && !saving && rankingLength < maxLength;
  const canMove = !disabled && !saving && isRanked;

  if (!isRanked) {
    return (
      <div className="rank-position-control is-unranked">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => onAdd(rankingLength)}
          aria-label={`Add ${entityName} to your ranking`}
        >+ Rank</button>
        {canAdd && positionCount > 1 ? (
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) onAdd(Number(event.target.value) - 1);
              event.currentTarget.value = "";
            }}
            aria-label={`Add ${entityName} at a specific rank`}
          >
            <option value="">at #</option>
            {Array.from({ length: positionCount }, (_, index) => <option key={index + 1} value={index + 1}>#{index + 1}</option>)}
          </select>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rank-position-control is-ranked">
      <span>Your #{currentRank}</span>
      <button type="button" disabled={!canMove || currentRank <= 1} onClick={() => onMove(currentRank - 2)} aria-label={`Move ${entityName} up`}>↑</button>
      <button type="button" disabled={!canMove || currentRank >= rankingLength} onClick={() => onMove(currentRank)} aria-label={`Move ${entityName} down`}>↓</button>
      <select
        value={currentRank}
        disabled={!canMove}
        onChange={(event) => onMove(Number(event.target.value) - 1)}
        aria-label={`Move ${entityName} to rank`}
      >
        {Array.from({ length: rankingLength }, (_, index) => <option key={index + 1} value={index + 1}>#{index + 1}</option>)}
      </select>
    </div>
  );
}

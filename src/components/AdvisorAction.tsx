import { useMemo } from 'react';
import { type AdvisorId } from '../types';

interface AdvisorActionProps {
  advisorId: AdvisorId | null;
  capitalStat: number;
  malikCooldown: number;
  krossAvailable?: boolean;
  santanaAvailable?: boolean;
  martialLawActive?: boolean;
  isCardRegion?: boolean;
  onAction: () => void;
}

export function AdvisorAction({ advisorId, capitalStat, malikCooldown, krossAvailable, santanaAvailable, martialLawActive, isCardRegion, onAction }: AdvisorActionProps) {
  const { label, className, disabled } = useMemo(() => {
    if (!advisorId) {
      return { 
        label: '[ ADVISOR SYSTEM OFFLINE ]', 
        className: 'advisor-action-btn', 
        disabled: true 
      };
    }

    if (advisorId === 'realpolitiker') {
      if (!krossAvailable) {
        return { 
          label: '[ PACIFICATION UNAVAILABLE UNTIL NEXT ELECTION ]', 
          className: 'advisor-action-btn', 
          disabled: true 
        };
      }
      if (!isCardRegion) {
        return { 
          label: '[ TARGET NON-REGIONAL ]', 
          className: 'advisor-action-btn', 
          disabled: true 
        };
      }
      return { 
        label: '[ INITIATE REGIONAL PACIFICATION ]', 
        className: 'advisor-action-btn glow-amber', 
        disabled: false 
      };
    }

    if (advisorId === 'revolutionary') {
      if (malikCooldown > 0) {
        return { 
          label: `[ FIXER RECHARGING... (${malikCooldown}T) ]`, 
          className: 'advisor-action-btn', 
          disabled: true 
        };
      }
      return { 
        label: '[ REWRITE PROPOSAL ]', 
        className: 'advisor-action-btn glow-amber', 
        disabled: false 
      };
    }

    if (advisorId === 'spin_doctor') {
      if (!santanaAvailable) {
        return { 
          label: '[ DAMAGE CONTROL UNAVAILABLE UNTIL NEXT ELECTION ]', 
          className: 'advisor-action-btn', 
          disabled: true 
        };
      }
      return { 
        label: '[ EXECUTE DAMAGE CONTROL ]', 
        className: 'advisor-action-btn glow-amber', 
        disabled: false 
      };
    }

    if (advisorId === 'iron_vance') {
      if (martialLawActive) {
        return { 
          label: '[ TERMINATE MARTIAL LAW: SEVERE PENALTY ]', 
          className: 'advisor-action-btn vane-alert', 
          disabled: false 
        };
      }
      return { 
        label: '[ DEPLOY MARTIAL LAW ]', 
        className: 'advisor-action-btn glow-amber', 
        disabled: false 
      };
    }

    if (advisorId === 'data_broker') {
      return { 
        label: '[ SURVEILLANCE BACKEND ACTIVE ]', 
        className: 'advisor-action-btn glow-amber', 
        disabled: true 
      };
    }

    if (advisorId === 'vulture') {
      if (capitalStat <= 10) {
        return {
          label: '[ EXECUTE BAILOUT ]',
          className: 'advisor-action-btn vane-alert',
          disabled: false
        };
      }
      return {
        label: '[ BUDGET NOMINAL ]',
        className: 'advisor-action-btn',
        disabled: true
      };
    }

    return { 
      label: '[ STANDBY ]', 
      className: 'advisor-action-btn', 
      disabled: true 
    };
  }, [advisorId, capitalStat, malikCooldown, krossAvailable, santanaAvailable, martialLawActive, isCardRegion]);

  return (
    <button className={className} disabled={disabled} type="button" onClick={onAction}>
      {label}
    </button>
  );
}

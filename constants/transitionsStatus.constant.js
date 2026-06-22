
const TRANSITIONS = {
  PENDING_REVIEW: 'accepted',
  accepted: 'in_production',
  in_production: 'ready',
  ready: 'completed',
};

module.exports=TRANSITIONS;
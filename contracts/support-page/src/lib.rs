#![no_std]

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype,
    Address, Env, String, Error,
};

use oryn_shared::OrynError;

const MAX_MESSAGE_LENGTH: u32 = 500;
const MAX_ASSET_CODE_LENGTH: u32 = 12;

contractmeta!(
    key = "Description",
    val = "Oryn Support Page"
);

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Admin,
    Paused,
    SupportCount,
    TotalSupportAmount,
    LastSupport,
}

#[contracttype]
#[derive(Clone)]
pub struct SupportEntry {
    pub donor: Address,
    pub recipient: Address,
    pub amount: i128,
    pub asset_code: String,
    pub message: String,
    pub timestamp: u64,
}

#[contract]
pub struct SupportPage;

#[contractimpl]
impl SupportPage {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&StorageKey::Admin) {
            return Err(OrynError::InvalidInput.into());
        }
        admin.require_auth();
        env.storage().persistent().set(&StorageKey::Admin, &admin);
        env.storage().persistent().set(&StorageKey::Paused, &false);
        env.storage().persistent().set(&StorageKey::SupportCount, &0u64);
        env.storage().persistent().set(&StorageKey::TotalSupportAmount, &0i128);
        Ok(())
    }

    pub fn pause(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        env.storage().persistent().set(&StorageKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        env.storage().persistent().set(&StorageKey::Paused, &false);
        Ok(())
    }

    pub fn submit_support(
        env: Env,
        donor: Address,
        recipient: Address,
        amount: i128,
        asset_code: String,
        message: String,
    ) -> Result<(), Error> {
        donor.require_auth();
        Self::require_not_paused(&env)?;

        if amount <= 0 {
            return Err(OrynError::InvalidInput.into());
        }
        if asset_code.len() == 0 {
            return Err(OrynError::InvalidInput.into());
        }
        if asset_code.len() > MAX_ASSET_CODE_LENGTH {
            return Err(OrynError::InvalidInput.into());
        }
        if message.len() > MAX_MESSAGE_LENGTH {
            return Err(OrynError::InvalidInput.into());
        }
        if donor == recipient {
            return Err(OrynError::InvalidInput.into());
        }

        let count: u64 = env.storage().persistent().get(&StorageKey::SupportCount).unwrap_or(0);
        let total: i128 = env.storage().persistent().get(&StorageKey::TotalSupportAmount).unwrap_or(0);

        env.storage().persistent().set(&StorageKey::SupportCount, &(count + 1));
        env.storage().persistent().set(&StorageKey::TotalSupportAmount, &(total + amount));

        let entry = SupportEntry {
            donor: donor.clone(),
            recipient,
            amount,
            asset_code: asset_code.clone(),
            message,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&StorageKey::LastSupport, &entry);

        Ok(())
    }

    pub fn get_support_count(env: Env) -> u64 {
        env.storage().persistent().get(&StorageKey::SupportCount).unwrap_or(0)
    }

    pub fn get_total_support_amount(env: Env) -> i128 {
        env.storage().persistent().get(&StorageKey::TotalSupportAmount).unwrap_or(0)
    }

    pub fn get_last_support(env: Env) -> SupportEntry {
        env.storage().persistent().get(&StorageKey::LastSupport).unwrap()
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().persistent().get(&StorageKey::Paused).unwrap_or(false)
    }

    fn require_not_paused(env: &Env) -> Result<(), Error> {
        let paused: bool = env.storage().persistent().get(&StorageKey::Paused).unwrap_or(false);
        if paused {
            return Err(OrynError::ContractPaused.into());
        }
        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        let admin: Address = env.storage().persistent().get(&StorageKey::Admin).unwrap();
        if caller != &admin {
            return Err(OrynError::Unauthorized.into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    fn setup(env: &Env) -> (SupportPageClient, Address) {
        let admin = Address::generate(env);
        let contract_id = env.register_contract(None, SupportPage);
        let client = SupportPageClient::new(env, &contract_id);
        client.initialize(&admin);
        (client, admin)
    }

    fn make_long_message(env: &Env, len: u32) -> String {
        let mut s = String::new(env);
        for _ in 0..len {
            s.push_str("a");
        }
        s
    }

    #[test]
    fn test_initialize_sets_initial_state() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);

        assert_eq!(client.get_support_count(), 0);
        assert_eq!(client.get_total_support_amount(), 0);
        assert_eq!(client.is_paused(), false);
    }

    #[test]
    #[should_panic]
    fn test_double_initialize_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let contract_id = env.register_contract(None, SupportPage);
        let client = SupportPageClient::new(&env, &contract_id);

        client.initialize(&admin);
        client.initialize(&admin);
    }

    #[test]
    fn test_submit_support_success() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.submit_support(
            &donor,
            &recipient,
            &1_000_000i128,
            &String::from_str(&env, "XLM"),
            &String::from_str(&env, "Great work!"),
        );

        assert_eq!(client.get_support_count(), 1);
        assert_eq!(client.get_total_support_amount(), 1_000_000);
        assert_eq!(client.is_paused(), false);

        let last = client.get_last_support();
        assert_eq!(last.donor, donor);
        assert_eq!(last.recipient, recipient);
        assert_eq!(last.amount, 1_000_000);
    }

    #[test]
    #[should_panic]
    fn test_submit_support_zero_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.submit_support(
            &donor,
            &recipient,
            &0i128,
            &String::from_str(&env, "XLM"),
            &String::from_str(&env, "Great work!"),
        );
    }

    #[test]
    #[should_panic]
    fn test_submit_support_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.submit_support(
            &donor,
            &recipient,
            &-1i128,
            &String::from_str(&env, "XLM"),
            &String::from_str(&env, "Great work!"),
        );
    }

    #[test]
    #[should_panic]
    fn test_submit_support_empty_asset_code_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.submit_support(
            &donor,
            &recipient,
            &1_000i128,
            &String::from_str(&env, ""),
            &String::from_str(&env, "Great work!"),
        );
    }

    #[test]
    #[should_panic]
    fn test_submit_support_asset_code_too_long_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.submit_support(
            &donor,
            &recipient,
            &1_000i128,
            &String::from_str(&env, "TOOLONGASSETCODE"),
            &String::from_str(&env, "Great work!"),
        );
    }

    #[test]
    #[should_panic]
    fn test_submit_support_message_too_long_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);
        let long_message = make_long_message(&env, MAX_MESSAGE_LENGTH + 1);

        client.submit_support(
            &donor,
            &recipient,
            &1_000i128,
            &String::from_str(&env, "XLM"),
            &long_message,
        );
    }

    #[test]
    fn test_submit_support_message_at_max_length_succeeds() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);
        let long_message = make_long_message(&env, MAX_MESSAGE_LENGTH);

        client.submit_support(
            &donor,
            &recipient,
            &1_000i128,
            &String::from_str(&env, "XLM"),
            &long_message,
        );

        assert_eq!(client.get_support_count(), 1);
    }

    #[test]
    #[should_panic]
    fn test_submit_support_self_support_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let donor = Address::generate(&env);

        client.submit_support(
            &donor,
            &donor,
            &1_000i128,
            &String::from_str(&env, "XLM"),
            &String::from_str(&env, "Self support"),
        );
    }

    #[test]
    #[should_panic]
    fn test_submit_support_when_paused_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.pause(&admin);

        client.submit_support(
            &donor,
            &recipient,
            &1_000i128,
            &String::from_str(&env, "XLM"),
            &String::from_str(&env, "Should fail"),
        );
    }

    #[test]
    fn test_submit_support_after_unpause_succeeds() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = setup(&env);
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.pause(&admin);
        client.unpause(&admin);

        client.submit_support(
            &donor,
            &recipient,
            &500i128,
            &String::from_str(&env, "USD"),
            &String::from_str(&env, "After unpause"),
        );

        assert_eq!(client.get_support_count(), 1);
    }

    #[test]
    #[should_panic]
    fn test_unauthorized_pause_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let fake_admin = Address::generate(&env);

        client.pause(&fake_admin);
    }

    #[test]
    #[should_panic]
    fn test_unauthorized_unpause_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _,) = setup(&env);
        let fake_admin = Address::generate(&env);

        client.unpause(&fake_admin);
    }

    #[test]
    fn test_multiple_support_increments_counts() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);

        for i in 0..5 {
            let donor = Address::generate(&env);
            let recipient = Address::generate(&env);
            let amount: i128 = 100 + i as i128;
            client.submit_support(
                &donor,
                &recipient,
                &amount,
                &String::from_str(&env, "XLM"),
                &String::from_str(&env, "Supporting!"),
            );
        }

        assert_eq!(client.get_support_count(), 5);
        assert_eq!(client.get_total_support_amount(), 100 + 101 + 102 + 103 + 104);
    }

    #[test]
    fn test_last_support_is_overwritten() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);

        let donor1 = Address::generate(&env);
        let donor2 = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.submit_support(
            &donor1,
            &recipient,
            &100i128,
            &String::from_str(&env, "XLM"),
            &String::from_str(&env, "First support"),
        );

        client.submit_support(
            &donor2,
            &recipient,
            &200i128,
            &String::from_str(&env, "BTC"),
            &String::from_str(&env, "Second support"),
        );

        let last = client.get_last_support();
        assert_eq!(last.donor, donor2);
        assert_eq!(last.amount, 200);
        assert_eq!(last.asset_code, String::from_str(&env, "BTC"));
    }

    #[test]
    fn test_is_paused_returns_true_after_pause() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = setup(&env);

        assert_eq!(client.is_paused(), false);
        client.pause(&admin);
        assert_eq!(client.is_paused(), true);
        client.unpause(&admin);
        assert_eq!(client.is_paused(), false);
    }
}
